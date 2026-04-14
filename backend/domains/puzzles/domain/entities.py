"""Puzzle domain entities."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from domains.puzzles.domain.value_objects import PuzzleAttemptResult


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Puzzle:
    fen: str
    solution_moves: list[str]
    rating: int
    themes: list[str]
    source_game_id: UUID | None = None
    id: UUID = field(default_factory=uuid4)


@dataclass
class PuzzleAttemptState:
    puzzle_id: UUID
    user_id: UUID
    attempts_count: int = 0
    solved: bool = False
    last_result: PuzzleAttemptResult | None = None
    last_attempted_at: datetime | None = None

    def record(self, result: PuzzleAttemptResult, attempted_at: datetime) -> None:
        self.attempts_count += 1
        self.last_result = result
        self.last_attempted_at = attempted_at
        if result == PuzzleAttemptResult.SOLVED:
            self.solved = True
