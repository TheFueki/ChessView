"""Port for profile read models."""

from abc import ABC, abstractmethod
from uuid import UUID

from domains.profiles.domain.entities import ProfilePlayer, ProfileSummary
from shared.time_controls import RatingSpeed


class AbstractProfileRepository(ABC):
    """Profile query repository."""

    @abstractmethod
    async def get_profile_summary(self, user_id: UUID, recent_game_limit: int = 8) -> ProfileSummary | None:
        """Return a profile summary with recent games."""
        ...
    @abstractmethod
    async def get_top_profiles(self, limit: int, category: RatingSpeed | None = None) -> list[ProfileSummary]:
        """Returns a list of profiles sorted by rating."""
        raise NotImplementedError()

    @abstractmethod
    async def search_players(self, query: str, limit: int = 10) -> list[ProfilePlayer]:
        """Return lightweight player search results."""
        raise NotImplementedError()
