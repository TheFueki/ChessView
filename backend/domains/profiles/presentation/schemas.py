from datetime import datetime
from pydantic import BaseModel

class ProfilePlayerResponse(BaseModel):
    id: str
    username: str
    rating: int
    avatar_url: str | None = None
    ratings: dict[str, int | None] | None = None

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
    ratings: dict[str, int | None] = {}
    global_rank: int = 0  
    coins: int = 0
    recent_games: list[ProfileGameResponse] = []


class PlayerSearchResultResponse(BaseModel):
    id: str
    username: str
    avatar_url: str | None = None
    ratings: dict[str, int | None] = {}


class HeadToHeadTournamentBreakdownResponse(BaseModel):
    tournament_id: str
    tournament_name: str
    games: int
    wins: int
    draws: int
    losses: int
    average_moves: float


class HeadToHeadResponse(BaseModel):
    user_id: str
    opponent_id: str
    total_games: int
    wins: int
    draws: int
    losses: int
    white_games: int
    white_wins: int
    white_draws: int
    white_losses: int
    black_games: int
    black_wins: int
    black_draws: int
    black_losses: int
    average_moves: float
    tournament_breakdown: list[HeadToHeadTournamentBreakdownResponse]
    recent_games: list[ProfileGameResponse]
