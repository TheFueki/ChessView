"""
Game WebSocket event handlers.

Handles: move, resign, draw_offer, draw_accept, draw_decline
Emits: game_state, game_over, draw_offered, draw_declined, error

Delegates to GameService; presentation layer only maps events to service calls.
"""

import logging
from uuid import UUID

import chess as chess_mod
from sqlalchemy.ext.asyncio import AsyncSession

from shared.events import EventType, WSEnvelope
from shared.ws_manager import manager
from domains.game.application.commands import AcceptDrawCommand, MakeMoveCommand, ResignCommand
from domains.game.application.services import GameService, current_clock_snapshot
from domains.game.domain.exceptions import GameNotActive, GameNotFound, IllegalMove, NotYourTurn
from domains.game.infrastructure.repository import SqlAlchemyGameRepository
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository
from domains.ratings.application.services import RatingService
from domains.ratings.infrastructure.repository import SqlAlchemyRatingRepository
from domains.tournaments.application.services import TournamentService
from domains.tournaments.infrastructure.repository import SqlAlchemyTournamentRepository

logger = logging.getLogger(__name__)


def _build_service(session: AsyncSession) -> GameService:
    return GameService(game_repo=SqlAlchemyGameRepository(session))


async def _player_info(user_repo: SqlAlchemyUserRepository, uid: UUID) -> dict:
    """Resolve a player's public info from DB."""
    user = await user_repo.get_by_id(uid)
    if user:
        return {"id": str(uid), "username": user.username, "rating": user.rating}
    return {"id": str(uid), "username": "?", "rating": 1200}


async def _game_state_payload(game, moves_list: list[str], session: AsyncSession) -> dict:
    """Build a GameStatePayload dict from a domain Game entity, with resolved player info."""
    board = chess_mod.Board(game.fen)
    user_repo = SqlAlchemyUserRepository(session)
    white_info = await _player_info(user_repo, game.white_id)
    black_info = await _player_info(user_repo, game.black_id)
    return {
        "fen": game.fen,
        "last_move": None,
        "turn": "white" if board.turn == chess_mod.WHITE else "black",
        "white": white_info,
        "black": black_info,
        "status": game.status,
        "termination_reason": game.termination_reason,
        "clock": current_clock_snapshot(game),
        "move_history": moves_list,
    }


async def _apply_ratings_if_needed(game_id: UUID, session: AsyncSession):
    rating_service = RatingService(SqlAlchemyRatingRepository(session))
    return await rating_service.apply_game_rating(game_id)


async def _sync_tournament_if_needed(game_id: UUID, session: AsyncSession) -> None:
    game_repo = SqlAlchemyGameRepository(session)
    service = TournamentService(
        tournament_repo=SqlAlchemyTournamentRepository(session),
        user_repo=SqlAlchemyUserRepository(session),
        game_repo=game_repo,
        game_service=GameService(game_repo),
    )
    await service.sync_game_result(game_id)


def _game_over_payload(game, rating_update, reason: str) -> dict:
    payload = {
        "status": game.status,
        "result": game.result,
        "reason": reason,
        "winner_id": str(game.white_id) if game.result == "1-0" else (str(game.black_id) if game.result == "0-1" else None),
        "clock": current_clock_snapshot(game),
    }
    if rating_update is not None:
        payload["rating_update"] = {
            "white": {
                "before": rating_update.white.before,
                "after": rating_update.white.after,
                "delta": rating_update.white.delta,
            },
            "black": {
                "before": rating_update.black.before,
                "after": rating_update.black.after,
                "delta": rating_update.black.delta,
            },
        }
    else:
        payload["rating_update"] = None
    return payload


async def handle_move(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Handle a 'move' event: validate via GameService, broadcast game_state."""
    game_id = envelope.game_id
    uci = envelope.payload.get("uci", "")

    if not game_id:
        await manager.send_error(user_id, "NOT_IN_GAME", "game_id is required for move")
        return
    if not uci:
        await manager.send_error(user_id, "ILLEGAL_MOVE", "uci field is required")
        return

    service = _build_service(session)
    try:
        game, move_entity = await service.make_move(
            MakeMoveCommand(game_id=UUID(game_id), user_id=UUID(user_id), uci=uci)
        )
    except GameNotFound:
        await manager.send_error(user_id, "NOT_IN_GAME", "Game not found")
        return
    except GameNotActive:
        await manager.send_error(user_id, "GAME_NOT_ACTIVE", "Game is not active")
        return
    except NotYourTurn:
        await manager.send_error(user_id, "NOT_YOUR_TURN", "It is not your turn")
        return
    except IllegalMove:
        await manager.send_error(user_id, "ILLEGAL_MOVE", f"Illegal move: {uci}")
        return

    # Build move history list
    all_moves = await SqlAlchemyGameRepository(session).get_moves(UUID(game_id))
    move_history = [m.uci for m in all_moves]
    rating_update = None
    if game.status != "active":
        rating_update = await _apply_ratings_if_needed(UUID(game_id), session)
        await _sync_tournament_if_needed(UUID(game_id), session)

    payload = await _game_state_payload(game, move_history, session)
    payload["last_move"] = {"uci": move_entity.uci, "move_number": move_entity.move_number} if move_entity else None

    if move_entity is not None or game.status == "active":
        await manager.broadcast_to_room(game_id, EventType.GAME_STATE, payload)

    # If game ended, also send game_over
    if game.status != "active":
        await manager.broadcast_to_room(
            game_id,
            EventType.GAME_OVER,
            _game_over_payload(game, rating_update, game.termination_reason or game.status),
        )


async def handle_resign(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Handle a 'resign' event: call GameService.resign, broadcast game_over."""
    game_id = envelope.game_id
    if not game_id:
        await manager.send_error(user_id, "NOT_IN_GAME", "game_id is required for resign")
        return

    service = _build_service(session)
    try:
        game = await service.resign(ResignCommand(game_id=UUID(game_id), user_id=UUID(user_id)))
    except GameNotFound:
        await manager.send_error(user_id, "NOT_IN_GAME", "Game not found")
        return
    except GameNotActive:
        await manager.send_error(user_id, "GAME_NOT_ACTIVE", "Game is not active")
        return

    rating_update = await _apply_ratings_if_needed(UUID(game_id), session)
    await _sync_tournament_if_needed(UUID(game_id), session)
    await manager.broadcast_to_room(
        game_id,
        EventType.GAME_OVER,
        _game_over_payload(game, rating_update, "resignation"),
    )


async def handle_draw_offer(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Handle a 'draw_offer' event: forward to opponent."""
    game_id = envelope.game_id
    if not game_id:
        await manager.send_error(user_id, "NOT_IN_GAME", "game_id required")
        return
    opponent_id = manager.get_opponent_id(game_id, user_id)
    if opponent_id:
        await manager.send_to_user(opponent_id, EventType.DRAW_OFFERED, {"from_user_id": user_id}, game_id=game_id)


async def handle_draw_accept(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Handle a 'draw_accept' event: finalize draw, broadcast game_over."""
    game_id = envelope.game_id
    if not game_id:
        await manager.send_error(user_id, "NOT_IN_GAME", "game_id required")
        return

    service = _build_service(session)
    try:
        game = await service.accept_draw(
            AcceptDrawCommand(game_id=UUID(game_id), user_id=UUID(user_id))
        )
    except GameNotFound:
        return
    except GameNotActive:
        return

    rating_update = await _apply_ratings_if_needed(UUID(game_id), session)
    await _sync_tournament_if_needed(UUID(game_id), session)
    await manager.broadcast_to_room(
        game_id,
        EventType.GAME_OVER,
        _game_over_payload(game, rating_update, "draw_agreement"),
    )


async def handle_draw_decline(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Handle a 'draw_decline' event: notify the offerer."""
    game_id = envelope.game_id
    if not game_id:
        return
    opponent_id = manager.get_opponent_id(game_id, user_id)
    if opponent_id:
        await manager.send_to_user(opponent_id, EventType.DRAW_DECLINED, {}, game_id=game_id)
