"""Application service for real club management."""

from __future__ import annotations

import re
from uuid import UUID

from fastapi import HTTPException, status

from domains.clubs.domain.entities import Club, ClubMember, ClubOwnerView, ClubView
from domains.clubs.domain.repository import AbstractClubRepository
from domains.identity.domain.repository import AbstractUserRepository


VALID_VISIBILITIES = {"public", "private"}
MAX_SLUG_LENGTH = 100


class ClubService:
    def __init__(self, club_repo: AbstractClubRepository, user_repo: AbstractUserRepository) -> None:
        self._club_repo = club_repo
        self._user_repo = user_repo

    async def create_club(
        self,
        owner_id: UUID,
        *,
        name: str,
        description: str,
        visibility: str = "public",
    ) -> ClubView:
        self._validate_visibility(visibility)
        slug = await self._unique_slug(name)
        club = await self._club_repo.create_club(
            Club(
                name=name.strip(),
                slug=slug,
                description=description.strip(),
                visibility=visibility,
                owner_id=owner_id,
            )
        )
        await self._club_repo.add_member(ClubMember(club_id=club.id, user_id=owner_id, role="owner"))
        return await self._to_view(club, owner_id)

    async def get_club(self, club_id: UUID, viewer_id: UUID) -> ClubView:
        club = await self._require_club(club_id)
        return await self._to_view(club, viewer_id)

    async def list_clubs(self, viewer_id: UUID, query: str | None = None) -> list[ClubView]:
        clubs = await self._club_repo.list_clubs(query=query.strip() if query else None)
        return [await self._to_view(club, viewer_id) for club in clubs]

    async def join_club(self, club_id: UUID, user_id: UUID) -> ClubView:
        club = await self._require_club(club_id)
        if club.visibility == "private":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Private clubs are invite-only")
        if await self._club_repo.get_member(club_id, user_id) is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Already a club member")

        await self._club_repo.add_member(ClubMember(club_id=club_id, user_id=user_id))
        return await self._to_view(club, user_id)

    async def leave_club(self, club_id: UUID, user_id: UUID) -> ClubView:
        club = await self._require_club(club_id)
        member = await self._club_repo.get_member(club_id, user_id)
        if member is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Club membership not found")
        if member.role == "owner":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Club owner cannot leave their own club")

        await self._club_repo.remove_member(club_id, user_id)
        return await self._to_view(club, user_id)

    async def update_club(
        self,
        club_id: UUID,
        viewer_id: UUID,
        *,
        name: str | None = None,
        description: str | None = None,
        visibility: str | None = None,
    ) -> ClubView:
        club = await self._require_club(club_id)
        await self._require_owner(club_id, viewer_id)

        if name is not None:
            normalized_name = name.strip()
            if normalized_name and normalized_name != club.name:
                club.name = normalized_name
                club.slug = await self._unique_slug(normalized_name, existing_club_id=club.id)
        if description is not None:
            club.description = description.strip()
        if visibility is not None:
            self._validate_visibility(visibility)
            club.visibility = visibility

        updated = await self._club_repo.update_club(club)
        return await self._to_view(updated, viewer_id)

    async def _require_club(self, club_id: UUID) -> Club:
        club = await self._club_repo.get_club(club_id)
        if club is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")
        return club

    async def _require_owner(self, club_id: UUID, viewer_id: UUID) -> None:
        member = await self._club_repo.get_member(club_id, viewer_id)
        if member is None or member.role != "owner":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the club owner can do that")

    async def _to_view(self, club: Club, viewer_id: UUID) -> ClubView:
        members = await self._club_repo.list_members(club.id)
        viewer_member = next((member for member in members if member.user_id == viewer_id), None)
        users = await self._user_repo.get_by_ids({club.owner_id})
        owner = users.get(club.owner_id)

        owner_view = None
        if owner is not None:
            owner_view = ClubOwnerView(
                id=owner.id,
                username=owner.username,
                rating=owner.rating,
                avatar_url=f"/media/avatars/{owner.avatar_path}" if getattr(owner, "avatar_path", None) else None,
            )

        return ClubView(
            id=club.id,
            name=club.name,
            slug=club.slug,
            description=club.description,
            visibility=club.visibility,
            owner_id=club.owner_id,
            owner=owner_view,
            member_count=len(members),
            viewer_is_member=viewer_member is not None,
            viewer_role=viewer_member.role if viewer_member else None,
            created_at=club.created_at,
            updated_at=club.updated_at,
        )

    async def _unique_slug(self, name: str, existing_club_id: UUID | None = None) -> str:
        base = _slugify(name)
        slug = base
        suffix = 2

        while True:
            existing = await self._club_repo.get_club_by_slug(slug)
            if existing is None or existing.id == existing_club_id:
                return slug
            suffix_text = f"-{suffix}"
            slug = f"{base[: MAX_SLUG_LENGTH - len(suffix_text)]}{suffix_text}"
            suffix += 1

    @staticmethod
    def _validate_visibility(visibility: str) -> None:
        if visibility not in VALID_VISIBILITIES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unsupported club visibility")


def _slugify(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return (normalized or "club")[:MAX_SLUG_LENGTH]
