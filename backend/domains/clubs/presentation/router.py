"""Club REST router."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.clubs.application.services import ClubService
from domains.clubs.infrastructure.repository import SqlAlchemyClubRepository
from domains.clubs.presentation.schemas import ClubCreateRequest, ClubPatchRequest, ClubResponse
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository


router = APIRouter()


def _build_service(session: AsyncSession) -> ClubService:
    return ClubService(
        SqlAlchemyClubRepository(session),
        SqlAlchemyUserRepository(session),
    )


@router.get("", response_model=list[ClubResponse])
async def list_clubs(
    query: str | None = Query(default=None, max_length=80),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    return await _build_service(session).list_clubs(UUID(user_id), query=query)


@router.post("", response_model=ClubResponse, status_code=status.HTTP_201_CREATED)
async def create_club(
    request: ClubCreateRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    return await _build_service(session).create_club(
        UUID(user_id),
        name=request.name,
        description=request.description,
        visibility=request.visibility,
    )


@router.get("/{club_id}", response_model=ClubResponse)
async def get_club(
    club_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    return await _build_service(session).get_club(club_id, UUID(user_id))


@router.patch("/{club_id}", response_model=ClubResponse)
async def update_club(
    club_id: UUID,
    request: ClubPatchRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    return await _build_service(session).update_club(
        club_id,
        UUID(user_id),
        **request.model_dump(exclude_unset=True),
    )


@router.post("/{club_id}/join", response_model=ClubResponse)
async def join_club(
    club_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    return await _build_service(session).join_club(club_id, UUID(user_id))


@router.delete("/{club_id}/join", response_model=ClubResponse)
async def leave_club(
    club_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    return await _build_service(session).leave_club(club_id, UUID(user_id))
