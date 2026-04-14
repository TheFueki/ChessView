"""
Game REST API router.

Provides read-only endpoints for match history.
No business logic here; delegates to GameService.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.game.application.services import GameService, current_clock_snapshot
from domains.game.domain.exceptions import GameNotFound
from domains.game.infrastructure.repository import SqlAlchemyGameRepository
from domains.game.presentation.schemas import GameDetailResponse, GameListResponse
from domains.game.presentation.serializers import (
    player_directory_from_users,
    to_game_detail_response,
    to_game_list_item,
)
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository

router = APIRouter()


def _build_service(session: AsyncSession) -> GameService:
    return GameService(game_repo=SqlAlchemyGameRepository(session))


async def _resolve_players(
    session: AsyncSession,
    user_ids: list[UUID] | set[UUID],
) -> object:
    users = await SqlAlchemyUserRepository(session).get_by_ids(user_ids)
    return player_directory_from_users(users)


@router.get("", response_model=GameListResponse)
async def list_games(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    """Get paginated list of current user's games."""
    current_user_id = UUID(user_id)
    game_repo = SqlAlchemyGameRepository(session)
    service = GameService(game_repo=game_repo)
    games, total = await service.get_user_games(current_user_id, page, size)

    user_ids = {g.white_id for g in games} | {g.black_id for g in games}
    players = await _resolve_players(session, user_ids)
    move_counts = await game_repo.get_move_counts([g.id for g in games])

    return GameListResponse(
        items=[
            to_game_list_item(game, current_user_id, players, move_counts.get(game.id, 0))
            for game in games
        ],
        total=total,
        page=page,
        size=size,
    )


@router.get("/{game_id}", response_model=GameDetailResponse)
async def get_game(
    game_id: UUID,
    session: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    """Get game detail with full move history."""
    service = _build_service(session)
    try:
        game, moves = await service.get_game_with_moves(game_id)
    except GameNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    players = await _resolve_players(session, {game.white_id, game.black_id} | {move.user_id for move in moves})

    return to_game_detail_response(
        game,
        moves,
        players,
        current_clock_snapshot(game),
    )
