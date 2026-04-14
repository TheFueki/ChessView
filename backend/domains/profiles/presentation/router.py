"""Profile REST router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.identity.domain.exceptions import UserNotFound
from domains.profiles.application.services import ProfileService
from domains.profiles.infrastructure.repository import SqlAlchemyProfileRepository
from domains.profiles.presentation.schemas import ProfileGameResponse, ProfilePlayerResponse, ProfileResponse

router = APIRouter()


def _build_service(session: AsyncSession) -> ProfileService:
    return ProfileService(profile_repo=SqlAlchemyProfileRepository(session))


def _serialize_profile(profile) -> ProfileResponse:
    return ProfileResponse(
        id=profile.id,
        username=profile.username,
        rating=profile.rating,
        avatar_url=profile.avatar_url,
        created_at=profile.created_at,
        games_played=profile.games_played,
        wins=profile.wins,
        losses=profile.losses,
        draws=profile.draws,
        win_rate=profile.win_rate,
        recent_games=[
            ProfileGameResponse(
                id=game.id,
                white=ProfilePlayerResponse(**game.white.__dict__),
                black=ProfilePlayerResponse(**game.black.__dict__),
                opponent=ProfilePlayerResponse(**game.opponent.__dict__),
                player_color=game.player_color,
                time_control_name=game.time_control_name,
                result=game.result,
                status=game.status,
                termination_reason=game.termination_reason,
                move_count=game.move_count,
                started_at=game.started_at,
                ended_at=game.ended_at,
                rated=game.rated,
                rating_delta=game.rating_delta,
            )
            for game in profile.recent_games
        ],
    )


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    recent_games: int = Query(8, ge=1, le=20),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    try:
        profile = await service.get_profile(UUID(user_id), recent_game_limit=recent_games)
    except UserNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _serialize_profile(profile)


@router.get("/{user_id}", response_model=ProfileResponse)
async def get_profile(
    user_id: UUID,
    recent_games: int = Query(8, ge=1, le=20),
    session: AsyncSession = Depends(get_db),
    _viewer_id: str = Depends(get_current_user_id),
):
    service = _build_service(session)
    try:
        profile = await service.get_profile(user_id, recent_game_limit=recent_games)
    except UserNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _serialize_profile(profile)
