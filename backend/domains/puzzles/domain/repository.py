"""Puzzle repository port."""

from abc import ABC, abstractmethod
from uuid import UUID

from domains.puzzles.domain.entities import Puzzle, PuzzleAttemptState


class AbstractPuzzleRepository(ABC):
    @abstractmethod
    async def list_puzzles(self, page: int = 1, size: int = 20) -> tuple[list[Puzzle], int]:
        ...

    @abstractmethod
    async def get_puzzle(self, puzzle_id: UUID) -> Puzzle | None:
        ...

    @abstractmethod
    async def get_random_puzzle(self, *, exclude_id: UUID | None = None) -> Puzzle | None:
        ...

    @abstractmethod
    async def get_attempt(self, user_id: UUID, puzzle_id: UUID) -> PuzzleAttemptState | None:
        ...

    @abstractmethod
    async def list_attempts(self, user_id: UUID, puzzle_ids: list[UUID]) -> dict[UUID, PuzzleAttemptState]:
        ...

    @abstractmethod
    async def save_attempt(self, attempt: PuzzleAttemptState) -> PuzzleAttemptState:
        ...
