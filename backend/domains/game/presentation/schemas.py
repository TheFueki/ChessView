"""
Pydantic DTOs for the game REST API.
"""

from datetime import datetime

from pydantic import BaseModel


class PlayerBrief(BaseModel):
    id: str
    username: str
    rating: int | None = None
    avatar_url: str | None = None


class PlayerDetail(PlayerBrief):
    rating: int


class MoveResponse(BaseModel):
    user_id: str
    username: str
    uci: str
    fen_after: str
    move_number: int
    created_at: datetime


class GameListItem(BaseModel):
    id: str
    white: PlayerBrief
    black: PlayerBrief
    opponent: PlayerBrief
    my_color: str
    rated: bool
    time_control_name: str
    result: str | None
    status: str
    termination_reason: str | None = None
    move_count: int
    rating_delta: int | None = None
    started_at: datetime
    ended_at: datetime | None


class GameListResponse(BaseModel):
    items: list[GameListItem]
    total: int
    page: int
    size: int


class RatingSummaryResponse(BaseModel):
    before: int
    after: int
    delta: int


class ClockStateResponse(BaseModel):
    time_control_name: str
    initial_time_ms: int
    increment_ms: int
    white_time_ms: int
    black_time_ms: int
    active_color: str | None
    is_paused: bool
    pause_reason: str | None
    disconnected_player_id: str | None
    grace_deadline_at: str | None
    last_updated_at: str


class GameDetailResponse(BaseModel):
    id: str
    white: PlayerDetail
    black: PlayerDetail
    rated: bool
    time_control_name: str
    status: str
    termination_reason: str | None
    result: str | None
    fen: str
    pgn: str | None
    move_count: int
    clock: ClockStateResponse
    white_rating: RatingSummaryResponse | None = None
    black_rating: RatingSummaryResponse | None = None
    started_at: datetime
    ended_at: datetime | None
    moves: list[MoveResponse]
