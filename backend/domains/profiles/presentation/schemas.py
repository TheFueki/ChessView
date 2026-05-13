from datetime import datetime
from pydantic import BaseModel

class ProfilePlayerResponse(BaseModel):
    id: str
    username: str
    rating: int
    avatar_url: str | None = None

class ProfileGameResponse(BaseModel):
    id: str
    white: ProfilePlayerResponse
    black: ProfilePlayerResponse
    opponent: ProfilePlayerResponse
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

class ProfileResponse(BaseModel):
    id: str
    username: str
    rating: int
    avatar_url: str | None = None
    created_at: datetime
    games_played: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    global_rank: int = 0  
    recent_games: list[ProfileGameResponse] = []