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
        id=str(profile.id),
        username=profile.username,
        rating=profile.rating,
        avatar_url=profile.avatar_url,
        created_at=profile.created_at,
        games_played=profile.games_played,
        wins=profile.wins,
        losses=profile.losses,
        draws=profile.draws,
        win_rate=profile.win_rate,
        global_rank=getattr(profile, "global_rank", 0), 
        recent_games=[
            ProfileGameResponse(
                id=str(game.id),
                white=ProfilePlayerResponse(
                    id=str(game.white.id),
                    username=game.white.username,
                    rating=game.white.rating,
                    avatar_url=game.white.avatar_url
                ),
                black=ProfilePlayerResponse(
                    id=str(game.black.id),
                    username=game.black.username,
                    rating=game.black.rating,
                    avatar_url=game.black.avatar_url
                ),
                opponent=ProfilePlayerResponse(
                    id=str(game.opponent.id),
                    username=game.opponent.username,
                    rating=game.opponent.rating,
                    avatar_url=game.opponent.avatar_url
                ),
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
            for game in (profile.recent_games or []) 
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

@router.get("/leaderboard", response_model=list[ProfileResponse])
async def get_global_leaderboard(
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    leaders = await service.get_top_players(limit=limit)
    return [_serialize_profile(p) for p in leaders]

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
