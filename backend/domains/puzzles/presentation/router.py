"""Puzzle REST router."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.puzzles.application.services import PuzzleOverview, PuzzleService
from domains.puzzles.domain.value_objects import PuzzleAttemptResult
from domains.puzzles.infrastructure.repository import SqlAlchemyPuzzleRepository
from domains.puzzles.presentation.schemas import (
    PuzzleAttemptStateResponse,
    PuzzleDetailResponse,
    PuzzleListResponse,
    PuzzleSummaryResponse,
    RecordPuzzleAttemptRequest,
)

router = APIRouter()


def _build_service(session: AsyncSession) -> PuzzleService:
    return PuzzleService(SqlAlchemyPuzzleRepository(session))


def _serialize_attempt(attempt) -> PuzzleAttemptStateResponse | None:
    if attempt is None:
        return None
    return PuzzleAttemptStateResponse(
        attempts_count=attempt.attempts_count,
        solved=attempt.solved,
        last_result=attempt.last_result,
        last_attempted_at=attempt.last_attempted_at,
    )


def _serialize_summary(overview: PuzzleOverview) -> PuzzleSummaryResponse:
    return PuzzleSummaryResponse(
        id=overview.puzzle.id,
        fen=overview.puzzle.fen,
        rating=overview.puzzle.rating,
        themes=list(overview.puzzle.themes),
        source_game_id=overview.puzzle.source_game_id,
        attempt=_serialize_attempt(overview.attempt),
    )


def _serialize_detail(overview: PuzzleOverview) -> PuzzleDetailResponse:
    summary = _serialize_summary(overview)
    return PuzzleDetailResponse(
        **summary.model_dump(),
        solution_moves=list(overview.puzzle.solution_moves),
    )


@router.get("", response_model=PuzzleListResponse)
async def list_puzzles(
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    items, total = await service.list_puzzles(UUID(user_id), page=page, size=size)
    return PuzzleListResponse(
        items=[_serialize_summary(item) for item in items],
        total=total,
        page=page,
        size=size,
    )


@router.get("/random", response_model=PuzzleDetailResponse)
async def get_random_puzzle(
    exclude_id: UUID | None = Query(None),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    puzzle = await service.get_random_puzzle(UUID(user_id), exclude_id=exclude_id)
    return _serialize_detail(puzzle)


@router.get("/{puzzle_id}", response_model=PuzzleDetailResponse)
async def get_puzzle(
    puzzle_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    puzzle = await service.get_puzzle(UUID(user_id), puzzle_id)
    return _serialize_detail(puzzle)


@router.post("/{puzzle_id}/attempts", response_model=PuzzleAttemptStateResponse, status_code=status.HTTP_200_OK)
async def record_attempt(
    puzzle_id: UUID,
    body: RecordPuzzleAttemptRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    attempt = await service.record_attempt(
        UUID(user_id),
        puzzle_id,
        PuzzleAttemptResult(body.result),
    )
    return _serialize_attempt(attempt)
