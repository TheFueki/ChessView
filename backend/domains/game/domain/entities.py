"""
Game domain entities.

Pure domain objects representing a chess game and individual moves.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from domains.game.domain.policies import DEFAULT_GAME_START_FEN, DEFAULT_INITIAL_RATING
from domains.game.domain.value_objects import GameResult, GameStatus, StartingRatings
from shared.time_controls import DEFAULT_TIME_CONTROL, TimeControl


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Game:
    """A chess game between two players."""

    id: UUID = field(default_factory=uuid4)
    white_id: UUID = field(default_factory=uuid4)
    black_id: UUID = field(default_factory=uuid4)
    time_control_name: str = DEFAULT_TIME_CONTROL.name
    initial_time_ms: int = DEFAULT_TIME_CONTROL.initial_time_ms
    increment_ms: int = DEFAULT_TIME_CONTROL.increment_ms
    white_time_ms: int = DEFAULT_TIME_CONTROL.initial_time_ms
    black_time_ms: int = DEFAULT_TIME_CONTROL.initial_time_ms
    last_clock_started_at: datetime | None = None
    disconnected_player_id: UUID | None = None
    disconnect_grace_deadline_at: datetime | None = None
    rated: bool = True
    white_rating_before: int = DEFAULT_INITIAL_RATING
    black_rating_before: int = DEFAULT_INITIAL_RATING
    white_rating_after: int | None = None
    black_rating_after: int | None = None
    status: GameStatus = GameStatus.ACTIVE
    result: GameResult | None = None
    fen: str = DEFAULT_GAME_START_FEN
    pgn: str | None = None
    started_at: datetime = field(default_factory=utc_now)
    ended_at: datetime | None = None
    termination_reason: str | None = None
    rating_applied_at: datetime | None = None

    @classmethod
    def new(
        cls,
        *,
        white_id: UUID,
        black_id: UUID,
        time_control: TimeControl,
        starting_ratings: StartingRatings,
        now: datetime,
        rated: bool = True,
    ) -> "Game":
        return cls(
            white_id=white_id,
            black_id=black_id,
            time_control_name=time_control.name,
            initial_time_ms=time_control.initial_time_ms,
            increment_ms=time_control.increment_ms,
            white_time_ms=time_control.initial_time_ms,
            black_time_ms=time_control.initial_time_ms,
            last_clock_started_at=now,
            rated=rated,
            white_rating_before=starting_ratings.white,
            black_rating_before=starting_ratings.black,
            started_at=now,
        )


@dataclass
class Move:
    """A single move within a game."""

    id: int | None = None  # DB-assigned serial
    game_id: UUID = field(default_factory=uuid4)
    user_id: UUID = field(default_factory=uuid4)
    uci: str = ""  # e.g. "e2e4"
    fen_after: str = ""
    move_number: int = 0
    created_at: datetime = field(default_factory=utc_now)
