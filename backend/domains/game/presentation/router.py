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
from domains.game.presentation.identity_verification import broadcast_identity_verification_forfeit
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository
from domains.identity.face_verification.schemas import (
    FaceVerificationSessionResponse,
    FaceVerificationStartRequest,
    FaceVerificationSubmitRequest,
)
from domains.identity.face_verification.service import FaceVerificationService
from domains.identity.face_verification.service import require_game_face_verification_access

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


@router.post("/{game_id}/face-verification/start", response_model=FaceVerificationSessionResponse)
async def start_game_face_verification(
    game_id: UUID,
    body: FaceVerificationStartRequest,
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    await require_game_face_verification_access(session, game_id, UUID(user_id))
    service = FaceVerificationService(session)
    verification = await service.start_session(
        user_id=UUID(user_id),
        game_id=game_id,
        tournament_id=body.tournament_id,
        scheduled_match_id=body.scheduled_match_id,
    )
    return service.session_response(verification)


@router.post("/{game_id}/face-verification/submit", response_model=FaceVerificationSessionResponse)
async def submit_game_face_verification(
    game_id: UUID,
    body: FaceVerificationSubmitRequest,
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    await require_game_face_verification_access(session, game_id, UUID(user_id))
    service = FaceVerificationService(session)
    verification = await service.start_session(user_id=UUID(user_id), game_id=game_id, tournament_id=None, scheduled_match_id=None)
    verification = await service.submit(verification.id, UUID(user_id), body.scenario)
    stopped_game = await service.stop_game_after_failed_verification(verification)
    if stopped_game is not None:
        await broadcast_identity_verification_forfeit(game_id, stopped_game, session)
    return service.session_response(verification)


@router.get("/{game_id}/face-verification/status", response_model=list[FaceVerificationSessionResponse])
async def game_face_verification_status(
    game_id: UUID,
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    await require_game_face_verification_access(session, game_id, UUID(user_id))
    from sqlalchemy import select
    from domains.identity.face_verification.models import FaceVerificationSessionModel

    result = await session.execute(
        select(FaceVerificationSessionModel)
        .where(FaceVerificationSessionModel.game_id == game_id)
        .order_by(FaceVerificationSessionModel.created_at.desc())
    )
    service = FaceVerificationService(session)
    return [service.session_response(item) for item in result.scalars().all()]
