"""Puzzle API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PuzzleAttemptStateResponse(BaseModel):
    attempts_count: int
    solved: bool
    last_result: str | None
    last_attempted_at: datetime | None


class PuzzleSummaryResponse(BaseModel):
    id: UUID
    fen: str
    rating: int
    themes: list[str]
    source_game_id: UUID | None
    attempt: PuzzleAttemptStateResponse | None = None


class PuzzleDetailResponse(PuzzleSummaryResponse):
    solution_moves: list[str]


class PuzzleListResponse(BaseModel):
    items: list[PuzzleSummaryResponse]
    total: int
    page: int
    size: int


class RecordPuzzleAttemptRequest(BaseModel):
    result: str = Field(pattern="^(solved|failed)$")
