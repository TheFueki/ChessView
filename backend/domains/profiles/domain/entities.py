"""Read models for player profiles."""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class ProfilePlayer:
    id: str
    username: str
    rating: int
    avatar_url: str | None = None


@dataclass(frozen=True)
class ProfileGamePreview:
    id: str
    white: ProfilePlayer
    black: ProfilePlayer
    opponent: ProfilePlayer
    player_color: str
    time_control_name: str
    result: str | None
    status: str
    termination_reason: str | None
    move_count: int
    started_at: datetime
    ended_at: datetime | None
    rated: bool
    rating_delta: int | None


@dataclass(frozen=True)
class ProfileSummary:
    id: str
    username: str
    rating: int
    avatar_url: str | None
    created_at: datetime
    games_played: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    recent_games: list[ProfileGamePreview] = field(default_factory=list)
