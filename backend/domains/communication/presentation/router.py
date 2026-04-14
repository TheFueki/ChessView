"""
Communication REST API router.

Provides read-only endpoint for chat message history.
Mounted under /api/games prefix via app/main.py.
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.communication.application.services import ChatService
from domains.communication.infrastructure.repository import SqlAlchemyChatRepository
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository
from domains.communication.presentation.schemas import ChatMessageResponse

router = APIRouter()


def _build_service(session: AsyncSession) -> ChatService:
    return ChatService(chat_repo=SqlAlchemyChatRepository(session))


@router.get("/{game_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    game_id: UUID,
    session: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Get all chat messages for a game."""
    service = _build_service(session)
    messages = await service.get_messages(game_id)

    user_repo = SqlAlchemyUserRepository(session)
    users = await user_repo.get_by_ids({m.user_id for m in messages})

    return [
        ChatMessageResponse(
            id=m.id,
            user_id=str(m.user_id),
            username=users.get(m.user_id).username if users.get(m.user_id) else "?",
            content=m.content,
            created_at=m.created_at,
        )
        for m in messages
    ]
