"""Port for profile read models."""

from abc import ABC, abstractmethod
from uuid import UUID

from domains.profiles.domain.entities import ProfileSummary


class AbstractProfileRepository(ABC):
    """Profile query repository."""

    @abstractmethod
    async def get_profile_summary(self, user_id: UUID, recent_game_limit: int = 8) -> ProfileSummary | None:
        """Return a profile summary with recent games."""
        ...
    @abstractmethod
    async def get_top_profiles(self, limit: int) -> list[ProfileSummary]:
        """Returns a list of profiles sorted by rating."""
        raise NotImplementedError()