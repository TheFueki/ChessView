"""Profile REST router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.identity.domain.exceptions import UserNotFound
from domains.profiles.application.head_to_head import HeadToHeadService
from domains.profiles.application.services import ProfileService
from domains.profiles.infrastructure.repository import SqlAlchemyProfileRepository
from domains.profiles.presentation.schemas import (
    HeadToHeadResponse,
    PlayerSearchResultResponse,
    ProfileGameResponse,
    ProfilePlayerResponse,
    ProfileResponse,
)
from shared.time_controls import RatingSpeed

router = APIRouter()


def _build_service(session: AsyncSession) -> ProfileService:
    return ProfileService(profile_repo=SqlAlchemyProfileRepository(session))


def _public_ratings(player) -> dict[str, int | None]:
    ratings = getattr(player, "ratings", None)
    if isinstance(ratings, dict) and ratings:
        return {key: value for key, value in ratings.items() if key in {"bullet", "blitz", "rapid"}}
    fallback = getattr(player, "rating", 1200)
    return {"bullet": fallback, "blitz": fallback, "rapid": fallback}

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
        ratings=profile.ratings,
        global_rank=getattr(profile, "global_rank", 0), 
        coins=getattr(profile, "coins", 0),
        recent_games=[
            ProfileGameResponse(
                id=str(game.id),
                white=ProfilePlayerResponse(
                    id=str(game.white.id),
                    username=game.white.username,
                    rating=game.white.rating,
                    avatar_url=game.white.avatar_url,
                    ratings=_public_ratings(game.white),
                ),
                black=ProfilePlayerResponse(
                    id=str(game.black.id),
                    username=game.black.username,
                    rating=game.black.rating,
                    avatar_url=game.black.avatar_url,
                    ratings=_public_ratings(game.black),
                ),
                opponent=ProfilePlayerResponse(
                    id=str(game.opponent.id),
                    username=game.opponent.username,
                    rating=game.opponent.rating,
                    avatar_url=game.opponent.avatar_url,
                    ratings=_public_ratings(game.opponent),
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
    category: RatingSpeed | None = Query(None),
    speed: RatingSpeed | None = Query(None),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    leaders = await service.get_top_players(limit=limit, category=category or speed)
    return [_serialize_profile(p) for p in leaders]

@router.get("/search", response_model=list[PlayerSearchResultResponse])
async def search_profiles(
    query: str = Query(..., min_length=1, max_length=32),
    limit: int = Query(10, ge=1, le=20),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    players = await service.search_players(query=query, limit=limit)
    return [
        PlayerSearchResultResponse(
            id=player.id,
            username=player.username,
            avatar_url=player.avatar_url,
            ratings=_public_ratings(player),
        )
        for player in players
    ]

@router.get("/{user_id}/head-to-head/{opponent_id}", response_model=HeadToHeadResponse)
async def get_head_to_head(
    user_id: UUID,
    opponent_id: UUID,
    session: AsyncSession = Depends(get_db),
):
    return await HeadToHeadService(session).get(user_id, opponent_id)

@router.get("/{user_id}", response_model=ProfileResponse)
async def get_profile(
    user_id: UUID,
    recent_games: int = Query(8, ge=1, le=20),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    try:
        profile = await service.get_profile(user_id, recent_game_limit=recent_games)
    except UserNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _serialize_profile(profile)
