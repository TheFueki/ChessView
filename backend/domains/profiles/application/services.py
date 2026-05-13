"""Profiles application service."""

from uuid import UUID

from domains.identity.domain.exceptions import UserNotFound
from domains.profiles.domain.entities import ProfileSummary
from domains.profiles.domain.repository import AbstractProfileRepository


class ProfileService:
    """Returns read-optimized profile data for the UI."""

    def __init__(self, profile_repo: AbstractProfileRepository) -> None:
        self._repo = profile_repo

    async def get_profile(self, user_id: UUID, recent_game_limit: int = 8) -> ProfileSummary:
        profile = await self._repo.get_profile_summary(user_id, recent_game_limit=recent_game_limit)
        if profile is None:
            raise UserNotFound()
        return profile

    async def get_top_players(self, limit: int = 50) -> list[ProfileSummary]:
        return await self._repo.get_top_profiles(limit=limit)