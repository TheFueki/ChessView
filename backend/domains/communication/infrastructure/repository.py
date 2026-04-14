"""
SQLAlchemy implementation of the chat message repository.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.communication.domain.entities import ChatMessage
from domains.communication.domain.repository import AbstractChatRepository
from domains.communication.infrastructure.models import ChatMessageModel


class SqlAlchemyChatRepository(AbstractChatRepository):
    """Concrete chat repository backed by PostgreSQL."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, message: ChatMessage) -> ChatMessage:
        model = ChatMessageModel(
            game_id=message.game_id,
            user_id=message.user_id,
            content=message.content,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return self._to_entity(model)

    async def list_by_game(self, game_id: UUID) -> list[ChatMessage]:
        stmt = (
            select(ChatMessageModel)
            .where(ChatMessageModel.game_id == game_id)
            .order_by(ChatMessageModel.created_at)
        )
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    @staticmethod
    def _to_entity(model: ChatMessageModel) -> ChatMessage:
        return ChatMessage(
            id=model.id,
            game_id=model.game_id,
            user_id=model.user_id,
            content=model.content,
            created_at=model.created_at,
        )
