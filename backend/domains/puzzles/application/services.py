"""Puzzle application services."""

from dataclasses import dataclass
from uuid import UUID

from domains.puzzles.domain.entities import Puzzle, PuzzleAttemptState, utc_now
from domains.puzzles.domain.exceptions import PuzzleNotFound
from domains.puzzles.domain.repository import AbstractPuzzleRepository
from domains.puzzles.domain.value_objects import PuzzleAttemptResult


@dataclass(frozen=True, slots=True)
class PuzzleOverview:
    puzzle: Puzzle
    attempt: PuzzleAttemptState | None


class PuzzleService:
    def __init__(self, puzzle_repo: AbstractPuzzleRepository) -> None:
        self._repo = puzzle_repo

    async def list_puzzles(self, user_id: UUID, page: int = 1, size: int = 20) -> tuple[list[PuzzleOverview], int]:
        puzzles, total = await self._repo.list_puzzles(page=page, size=size)
        attempts = await self._repo.list_attempts(user_id, [puzzle.id for puzzle in puzzles])
        return [
            PuzzleOverview(puzzle=puzzle, attempt=attempts.get(puzzle.id))
            for puzzle in puzzles
        ], total

    async def get_puzzle(self, user_id: UUID, puzzle_id: UUID) -> PuzzleOverview:
        puzzle = await self._repo.get_puzzle(puzzle_id)
        if puzzle is None:
            raise PuzzleNotFound()
        attempt = await self._repo.get_attempt(user_id, puzzle_id)
        return PuzzleOverview(puzzle=puzzle, attempt=attempt)

    async def get_random_puzzle(self, user_id: UUID, *, exclude_id: UUID | None = None) -> PuzzleOverview:
        puzzle = await self._repo.get_random_puzzle(exclude_id=exclude_id)
        if puzzle is None:
            raise PuzzleNotFound()
        attempt = await self._repo.get_attempt(user_id, puzzle.id)
        return PuzzleOverview(puzzle=puzzle, attempt=attempt)

    async def record_attempt(
        self,
        user_id: UUID,
        puzzle_id: UUID,
        result: PuzzleAttemptResult,
    ) -> PuzzleAttemptState:
        puzzle = await self._repo.get_puzzle(puzzle_id)
        if puzzle is None:
            raise PuzzleNotFound()

        attempt = await self._repo.get_attempt(user_id, puzzle_id)
        if attempt is None:
            attempt = PuzzleAttemptState(puzzle_id=puzzle_id, user_id=user_id)

        attempt.record(result, utc_now())
        return await self._repo.save_attempt(attempt)
