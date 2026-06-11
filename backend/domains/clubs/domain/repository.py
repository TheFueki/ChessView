"""Repository port for clubs."""

from abc import ABC, abstractmethod
from uuid import UUID

from domains.clubs.domain.entities import Club, ClubMember


class AbstractClubRepository(ABC):
    @abstractmethod
    async def create_club(self, club: Club) -> Club:
        ...

    @abstractmethod
    async def get_club(self, club_id: UUID) -> Club | None:
        ...

    @abstractmethod
    async def get_club_by_slug(self, slug: str) -> Club | None:
        ...

    @abstractmethod
    async def list_clubs(self, query: str | None = None) -> list[Club]:
        ...

    @abstractmethod
    async def update_club(self, club: Club) -> Club:
        ...

    @abstractmethod
    async def add_member(self, member: ClubMember) -> ClubMember:
        ...

    @abstractmethod
    async def get_member(self, club_id: UUID, user_id: UUID) -> ClubMember | None:
        ...

    @abstractmethod
    async def list_members(self, club_id: UUID) -> list[ClubMember]:
        ...

    @abstractmethod
    async def remove_member(self, club_id: UUID, user_id: UUID) -> None:
        ...
