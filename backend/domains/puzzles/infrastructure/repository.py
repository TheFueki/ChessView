"""SQLAlchemy puzzle repository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.puzzles.domain.entities import Puzzle, PuzzleAttemptState
from domains.puzzles.domain.repository import AbstractPuzzleRepository
from domains.puzzles.domain.value_objects import PuzzleAttemptResult
from domains.puzzles.infrastructure.models import PuzzleAttemptModel, PuzzleModel


class SqlAlchemyPuzzleRepository(AbstractPuzzleRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_puzzles(self, page: int = 1, size: int = 20) -> tuple[list[Puzzle], int]:
        total = await self._session.scalar(select(func.count()).select_from(PuzzleModel)) or 0
        result = await self._session.execute(
            select(PuzzleModel)
            .order_by(PuzzleModel.rating, PuzzleModel.created_at)
            .offset((page - 1) * size)
            .limit(size)
        )
        return [self._to_puzzle(model) for model in result.scalars().all()], int(total)

    async def get_puzzle(self, puzzle_id: UUID) -> Puzzle | None:
        result = await self._session.execute(select(PuzzleModel).where(PuzzleModel.id == puzzle_id))
        model = result.scalar_one_or_none()
        return self._to_puzzle(model) if model else None

    async def get_random_puzzle(self, *, exclude_id: UUID | None = None) -> Puzzle | None:
        stmt = select(PuzzleModel)
        if exclude_id is not None:
            stmt = stmt.where(PuzzleModel.id != exclude_id)
        result = await self._session.execute(stmt.order_by(func.random()).limit(1))
        model = result.scalar_one_or_none()
        if model is None and exclude_id is not None:
            result = await self._session.execute(select(PuzzleModel).order_by(func.random()).limit(1))
            model = result.scalar_one_or_none()
        return self._to_puzzle(model) if model else None

    async def get_attempt(self, user_id: UUID, puzzle_id: UUID) -> PuzzleAttemptState | None:
        result = await self._session.execute(
            select(PuzzleAttemptModel).where(
                PuzzleAttemptModel.user_id == user_id,
                PuzzleAttemptModel.puzzle_id == puzzle_id,
            )
        )
        model = result.scalar_one_or_none()
        return self._to_attempt(model) if model else None

    async def list_attempts(self, user_id: UUID, puzzle_ids: list[UUID]) -> dict[UUID, PuzzleAttemptState]:
        if not puzzle_ids:
            return {}
        result = await self._session.execute(
            select(PuzzleAttemptModel).where(
                PuzzleAttemptModel.user_id == user_id,
                PuzzleAttemptModel.puzzle_id.in_(puzzle_ids),
            )
        )
        return {
            model.puzzle_id: self._to_attempt(model)
            for model in result.scalars().all()
        }

    async def save_attempt(self, attempt: PuzzleAttemptState) -> PuzzleAttemptState:
        result = await self._session.execute(
            select(PuzzleAttemptModel).where(
                PuzzleAttemptModel.user_id == attempt.user_id,
                PuzzleAttemptModel.puzzle_id == attempt.puzzle_id,
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            model = PuzzleAttemptModel(
                puzzle_id=attempt.puzzle_id,
                user_id=attempt.user_id,
            )
            self._session.add(model)

        model.attempts_count = attempt.attempts_count
        model.solved = attempt.solved
        model.last_result = attempt.last_result
        model.last_attempted_at = attempt.last_attempted_at
        await self._session.commit()
        await self._session.refresh(model)
        return self._to_attempt(model)

    @staticmethod
    def _to_puzzle(model: PuzzleModel) -> Puzzle:
        return Puzzle(
            id=model.id,
            fen=model.fen,
            solution_moves=list(model.solution_moves),
            rating=model.rating,
            themes=list(model.themes),
            source_game_id=model.source_game_id,
        )

    @staticmethod
    def _to_attempt(model: PuzzleAttemptModel) -> PuzzleAttemptState:
        return PuzzleAttemptState(
            puzzle_id=model.puzzle_id,
            user_id=model.user_id,
            attempts_count=model.attempts_count,
            solved=model.solved,
            last_result=PuzzleAttemptResult(model.last_result) if model.last_result is not None else None,
            last_attempted_at=model.last_attempted_at,
        )
