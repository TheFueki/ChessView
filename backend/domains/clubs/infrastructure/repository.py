"""SQLAlchemy club repository."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.clubs.domain.entities import Club, ClubMember
from domains.clubs.domain.repository import AbstractClubRepository
from domains.clubs.infrastructure.models import ClubMemberModel, ClubModel


class SqlAlchemyClubRepository(AbstractClubRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_club(self, club: Club) -> Club:
        model = self._new_club_model(club)
        self._session.add(model)
        await self._persist(model)
        return self._to_club(model)

    async def get_club(self, club_id: UUID) -> Club | None:
        model = await self._get_club_model(club_id)
        return self._to_club(model) if model else None

    async def get_club_by_slug(self, slug: str) -> Club | None:
        result = await self._session.execute(select(ClubModel).where(ClubModel.slug == slug))
        model = result.scalar_one_or_none()
        return self._to_club(model) if model else None

    async def list_clubs(self, query: str | None = None) -> list[Club]:
        stmt = select(ClubModel).order_by(ClubModel.created_at.desc())
        if query:
            needle = f"%{query}%"
            stmt = stmt.where(ClubModel.name.ilike(needle) | ClubModel.description.ilike(needle))
        result = await self._session.execute(stmt)
        return [self._to_club(model) for model in result.scalars().all()]

    async def update_club(self, club: Club) -> Club:
        model = await self._get_club_model(club.id)
        if model is None:
            raise ValueError(f"Club {club.id} not found")
        self._apply_club_state(model, club)
        model.updated_at = datetime.now(timezone.utc)
        await self._persist(model)
        return self._to_club(model)

    async def add_member(self, member: ClubMember) -> ClubMember:
        model = self._new_member_model(member)
        self._session.add(model)
        await self._persist(model)
        return self._to_member(model)

    async def get_member(self, club_id: UUID, user_id: UUID) -> ClubMember | None:
        result = await self._session.execute(
            select(ClubMemberModel).where(
                ClubMemberModel.club_id == club_id,
                ClubMemberModel.user_id == user_id,
            )
        )
        model = result.scalar_one_or_none()
        return self._to_member(model) if model else None

    async def list_members(self, club_id: UUID) -> list[ClubMember]:
        result = await self._session.execute(
            select(ClubMemberModel)
            .where(ClubMemberModel.club_id == club_id)
            .order_by(ClubMemberModel.joined_at)
        )
        return [self._to_member(model) for model in result.scalars().all()]

    async def remove_member(self, club_id: UUID, user_id: UUID) -> None:
        result = await self._session.execute(
            select(ClubMemberModel).where(
                ClubMemberModel.club_id == club_id,
                ClubMemberModel.user_id == user_id,
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            return
        await self._session.delete(model)
        await self._session.commit()

    async def _get_club_model(self, club_id: UUID) -> ClubModel | None:
        result = await self._session.execute(select(ClubModel).where(ClubModel.id == club_id))
        return result.scalar_one_or_none()

    @staticmethod
    def _new_club_model(club: Club) -> ClubModel:
        model = ClubModel(id=club.id, owner_id=club.owner_id)
        SqlAlchemyClubRepository._apply_club_state(model, club)
        return model

    @staticmethod
    def _apply_club_state(model: ClubModel, club: Club) -> None:
        model.name = club.name
        model.slug = club.slug
        model.description = club.description
        model.visibility = club.visibility
        model.owner_id = club.owner_id
        model.created_at = club.created_at
        model.updated_at = club.updated_at

    @staticmethod
    def _new_member_model(member: ClubMember) -> ClubMemberModel:
        model = ClubMemberModel(club_id=member.club_id, user_id=member.user_id)
        model.role = member.role
        model.joined_at = member.joined_at
        return model

    @staticmethod
    def _to_club(model: ClubModel) -> Club:
        return Club(
            id=model.id,
            name=model.name,
            slug=model.slug,
            description=model.description,
            visibility=model.visibility,
            owner_id=model.owner_id,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_member(model: ClubMemberModel) -> ClubMember:
        return ClubMember(
            id=model.id,
            club_id=model.club_id,
            user_id=model.user_id,
            role=model.role,
            joined_at=model.joined_at,
        )

    async def _persist(self, model: ClubModel | ClubMemberModel) -> None:
        await self._session.commit()
        await self._session.refresh(model)
