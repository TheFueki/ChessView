"""
Central WebSocket endpoint and event dispatcher.

Responsibilities:
- Authenticate WebSocket connections via JWT query param
- Maintain connection lifecycle with ConnectionManager
- Parse incoming JSON into WSEnvelope
- Dispatch to the correct domain handler based on event type
- Provide a fresh DB session per handled event
"""

import json
import logging
from collections.abc import Callable, Coroutine
from typing import Any
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from domains.game.application.services import GameService
from domains.game.infrastructure.repository import SqlAlchemyGameRepository
from infrastructure.database import async_session_factory
from infrastructure.security import decode_token
from shared.events import EventType, WSEnvelope
from shared.exception_handlers import map_exception_to_ws_error
from shared.ws_manager import manager

# Handler type: async (envelope, user_id, session) -> None
Handler = Callable[[WSEnvelope, str, AsyncSession], Coroutine[Any, Any, None]]

logger = logging.getLogger(__name__)


def _build_event_handlers() -> dict[str, Handler]:
    """Import and wire all domain WS handlers. Called once at module load."""
    from domains.matchmaking.presentation.ws_handler import (
        handle_queue_join,
        handle_queue_leave,
    )
    from domains.game.presentation.ws_handler import (
        handle_move,
        handle_resign,
        handle_draw_offer,
        handle_draw_accept,
        handle_draw_decline,
    )
    from domains.communication.presentation.ws_handler import handle_chat_send
    from domains.rtc.presentation.ws_handler import (
        handle_rtc_offer,
        handle_rtc_answer,
        handle_rtc_ice,
    )

    return {
        EventType.QUEUE_JOIN: handle_queue_join,
        EventType.QUEUE_LEAVE: handle_queue_leave,
        EventType.MOVE: handle_move,
        EventType.RESIGN: handle_resign,
        EventType.DRAW_OFFER: handle_draw_offer,
        EventType.DRAW_ACCEPT: handle_draw_accept,
        EventType.DRAW_DECLINE: handle_draw_decline,
        EventType.CHAT_SEND: handle_chat_send,
        EventType.RTC_OFFER: handle_rtc_offer,
        EventType.RTC_ANSWER: handle_rtc_answer,
        EventType.RTC_ICE: handle_rtc_ice,
    }


EVENT_HANDLERS: dict[str, Handler] = _build_event_handlers()


async def _restore_active_room_membership(user_id: str):
    """
    Re-join a user's active game room after reconnect.

    Without this, refresh/reconnect breaks chat, RTC, and room-scoped broadcasts.
    """
    async with async_session_factory() as session:
        active_game = await SqlAlchemyGameRepository(session).get_active_by_user(UUID(user_id))
        if active_game is not None:
            manager.join_room(str(active_game.id), user_id)
        return active_game


async def ws_endpoint(websocket: WebSocket) -> None:
    """Single WebSocket entry point at /ws?token=<jwt>."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id: str = payload["sub"]
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    await manager.connect(user_id, websocket)
    active_game = await _restore_active_room_membership(user_id)
    if active_game is not None:
        async with async_session_factory() as session:
            service = GameService(SqlAlchemyGameRepository(session))
            resumed_game = await service.mark_reconnected(UUID(user_id))
            if resumed_game is not None:
                from domains.game.presentation.ws_handler import _game_state_payload

                moves = await SqlAlchemyGameRepository(session).get_moves(resumed_game.id)
                payload = await _game_state_payload(resumed_game, [move.uci for move in moves], session)
                payload["last_move"] = (
                    {"uci": moves[-1].uci, "move_number": moves[-1].move_number} if moves else None
                )
                await manager.broadcast_to_room(str(resumed_game.id), EventType.GAME_STATE, payload)
    logger.info("WS connected: user_id=%s", user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                envelope = WSEnvelope(**data)
            except Exception:
                await manager.send_error(user_id, "INVALID_EVENT", "Malformed envelope")
                continue

            handler = EVENT_HANDLERS.get(envelope.type)
            if handler is None:
                await manager.send_error(user_id, "INVALID_EVENT", f"Unknown event type: {envelope.type}")
                continue

            async with async_session_factory() as session:
                try:
                    await handler(envelope, user_id, session)
                except Exception as exc:
                    mapped_error = map_exception_to_ws_error(exc)
                    if mapped_error is not None:
                        code, message = mapped_error
                        await manager.send_error(user_id, code, message)
                        continue

                    logger.exception("Handler error for event=%s user=%s", envelope.type, user_id)
                    await manager.send_error(user_id, "INTERNAL_ERROR", "An unexpected error occurred")

    except WebSocketDisconnect:
        logger.info("WS disconnected: user_id=%s", user_id)
    finally:
        is_current_connection = manager.is_current_connection(user_id, websocket)
        disconnected_game = None
        if is_current_connection:
            try:
                from domains.matchmaking.application.services import MatchmakingService

                await MatchmakingService().leave_queue(UUID(user_id))
            except Exception:
                pass
            async with async_session_factory() as session:
                try:
                    service = GameService(SqlAlchemyGameRepository(session))
                    disconnected_game = await service.mark_disconnected(UUID(user_id))
                except Exception:
                    logger.exception("Failed to mark disconnect for user_id=%s", user_id)
        await manager.disconnect(user_id, websocket)
        if disconnected_game is not None:
            async with async_session_factory() as session:
                from domains.game.presentation.ws_handler import _game_state_payload

                moves = await SqlAlchemyGameRepository(session).get_moves(disconnected_game.id)
                payload = await _game_state_payload(disconnected_game, [move.uci for move in moves], session)
                payload["last_move"] = (
                    {"uci": moves[-1].uci, "move_number": moves[-1].move_number} if moves else None
                )
                await manager.broadcast_to_room(str(disconnected_game.id), EventType.GAME_STATE, payload)
