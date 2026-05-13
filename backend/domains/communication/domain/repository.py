"""
Abstract chat message repository   port for persistence.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from domains.communication.domain.entities import ChatMessage


class AbstractChatRepository(ABC):

    @abstractmethod
    async def create(self, message: ChatMessage) -> ChatMessage:
        """Persist a new chat message."""
        ...

    @abstractmethod
    async def list_by_game(self, game_id: UUID) -> list[ChatMessage]:
        """Retrieve all messages for a game, ordered by created_at."""
        ...
