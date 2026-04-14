"""Clock-oriented game domain rules."""

from dataclasses import asdict, dataclass
from datetime import datetime
from uuid import UUID

import chess

from domains.game.domain.entities import Game
from domains.game.domain.value_objects import Color, GameStatus


@dataclass(frozen=True)
class ClockSnapshot:
    time_control_name: str
    initial_time_ms: int
    increment_ms: int
    white_time_ms: int
    black_time_ms: int
    active_color: Color | None
    is_paused: bool
    pause_reason: str | None
    disconnected_player_id: UUID | None
    grace_deadline_at: datetime | None
    last_updated_at: datetime

    def to_payload(self) -> dict[str, str | int | bool | None]:
        payload = asdict(self)
        payload["active_color"] = self.active_color.value if self.active_color is not None else None
        payload["disconnected_player_id"] = (
            str(self.disconnected_player_id) if self.disconnected_player_id is not None else None
        )
        payload["grace_deadline_at"] = (
            self.grace_deadline_at.isoformat() if self.grace_deadline_at is not None else None
        )
        payload["last_updated_at"] = self.last_updated_at.isoformat()
        return payload


def active_color(game: Game) -> Color | None:
    if game.status != GameStatus.ACTIVE:
        return None
    return Color.WHITE if chess.Board(game.fen).turn == chess.WHITE else Color.BLACK


def active_player_id(game: Game) -> UUID | None:
    current_color = active_color(game)
    if current_color == Color.WHITE:
        return game.white_id
    if current_color == Color.BLACK:
        return game.black_id
    return None


def capture_clock_snapshot(game: Game, now: datetime) -> ClockSnapshot:
    white_time_ms = game.white_time_ms
    black_time_ms = game.black_time_ms
    running_color = active_color(game)

    if _clock_is_running(game, running_color):
        elapsed_ms = max(0, int((now - game.last_clock_started_at).total_seconds() * 1000))
        if running_color == Color.WHITE:
            white_time_ms = max(0, white_time_ms - elapsed_ms)
        elif running_color == Color.BLACK:
            black_time_ms = max(0, black_time_ms - elapsed_ms)

    pause_reason = _pause_reason(game)
    return ClockSnapshot(
        time_control_name=game.time_control_name,
        initial_time_ms=game.initial_time_ms,
        increment_ms=game.increment_ms,
        white_time_ms=white_time_ms,
        black_time_ms=black_time_ms,
        active_color=running_color if pause_reason is None else None,
        is_paused=pause_reason is not None,
        pause_reason=pause_reason,
        disconnected_player_id=game.disconnected_player_id,
        grace_deadline_at=game.disconnect_grace_deadline_at,
        last_updated_at=now,
    )


def active_remaining_time_ms(game: Game, now: datetime) -> int:
    if game.status != GameStatus.ACTIVE or game.disconnect_grace_deadline_at is not None:
        return 1

    snapshot = capture_clock_snapshot(game, now)
    if snapshot.active_color == Color.WHITE:
        return snapshot.white_time_ms
    if snapshot.active_color == Color.BLACK:
        return snapshot.black_time_ms
    return 1


def _clock_is_running(game: Game, running_color: Color | None) -> bool:
    return (
        game.status == GameStatus.ACTIVE
        and game.last_clock_started_at is not None
        and game.disconnect_grace_deadline_at is None
        and running_color is not None
    )


def _pause_reason(game: Game) -> str | None:
    if game.disconnect_grace_deadline_at is not None:
        return "disconnect"
    if game.status != GameStatus.ACTIVE:
        return "game_over"
    return None
