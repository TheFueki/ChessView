"""
Communication WebSocket event handlers.

Handles: chat_send
Emits: chat_message
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from shared.events import EventType, WSEnvelope
from shared.ws_manager import manager
from domains.communication.application.services import ChatService
from domains.communication.domain.exceptions import MessageTooLong
from domains.communication.infrastructure.repository import SqlAlchemyChatRepository
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository

logger = logging.getLogger(__name__)


async def handle_chat_send(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """
    Handle a 'chat_send' event: validate, persist, broadcast to game room.

    Expected payload: { content: str }
    """
    content = envelope.payload.get("content", "")
    game_id = envelope.game_id

    if not game_id:
        await manager.send_error(user_id, "NOT_IN_GAME", "game_id is required for chat")
        return
    if not content.strip():
        return

    # Verify sender is actually in this game room
    room = manager.game_rooms.get(game_id, set())
    if user_id not in room:
        await manager.send_error(user_id, "NOT_IN_GAME", "You are not in this game")
        return

    chat_service = ChatService(chat_repo=SqlAlchemyChatRepository(session))

    try:
        message = await chat_service.send_message(UUID(game_id), UUID(user_id), content)
    except MessageTooLong:
        await manager.send_error(user_id, "MESSAGE_TOO_LONG", "Message exceeds 500 characters")
        return

    # Resolve username for broadcast
    user_repo = SqlAlchemyUserRepository(session)
    user = await user_repo.get_by_id(UUID(user_id))
    username = user.username if user else "?"

    await manager.broadcast_to_room(game_id, EventType.CHAT_MESSAGE, {
        "id": message.id,
        "user_id": user_id,
        "username": username,
        "content": message.content,
        "created_at": message.created_at.isoformat(),
    })
