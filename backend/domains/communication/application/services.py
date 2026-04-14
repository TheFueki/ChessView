"""
Communication application service.

Handles chat message creation and retrieval.
"""

from uuid import UUID

from domains.communication.domain.entities import ChatMessage
from domains.communication.domain.exceptions import MessageTooLong
from domains.communication.domain.repository import AbstractChatRepository

MAX_MESSAGE_LENGTH = 500


class ChatService:
    """Application service for in-game chat."""

    def __init__(self, chat_repo: AbstractChatRepository) -> None:
        self._repo = chat_repo

    async def send_message(self, game_id: UUID, user_id: UUID, content: str) -> ChatMessage:
        """
        Validate and persist a chat message.

        Raises MessageTooLong if content exceeds limit.
        """
        if len(content) > MAX_MESSAGE_LENGTH:
            raise MessageTooLong()

        message = ChatMessage(game_id=game_id, user_id=user_id, content=content)
        return await self._repo.create(message)

    async def get_messages(self, game_id: UUID) -> list[ChatMessage]:
        """Retrieve all chat messages for a game."""
        return await self._repo.list_by_game(game_id)
