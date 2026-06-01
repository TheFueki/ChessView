"""Pydantic DTOs for tournament APIs."""

from datetime import datetime

from pydantic import BaseModel, Field


class TournamentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    time_control_name: str
    initial_time_ms: int | None = Field(default=None, ge=1)
    increment_ms: int | None = Field(default=None, ge=0)
    tournament_type: str = "swiss"
    entry_fee_cents: int = Field(default=0, ge=0)
    total_rounds: int | None = Field(default=None, ge=1)


class TournamentPatchRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    entry_fee_cents: int | None = Field(None, ge=0)
    total_rounds: int | None = Field(None, ge=1)


class OTBPlayerCreateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=32)
    seed_rating: int = Field(default=1200, ge=100, le=3000)


class TournamentPlayerResponse(BaseModel):
    id: str
    username: str
    rating: int
    status: str = "active"


class TournamentStandingResponse(BaseModel):
    rank: int
    player: TournamentPlayerResponse
    score: float
    games_played: int


class TournamentPairingResponse(BaseModel):
    id: int | None
    round_number: int
    white: TournamentPlayerResponse
    black: TournamentPlayerResponse | None = None
    game_id: str | None = None
    game_status: str | None = None
    result: str | None = None


class TournamentRoundResponse(BaseModel):
    round_number: int
    pairings: list[TournamentPairingResponse]


class TournamentSummaryResponse(BaseModel):
    id: str
    name: str
    time_control_name: str
    tournament_type: str = "swiss"
    entry_fee_cents: int = 0
    status: str
    current_round: int
    total_rounds: int
    player_count: int
    owner: TournamentPlayerResponse
    viewer_is_member: bool
    viewer_is_owner: bool
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class TournamentDetailResponse(TournamentSummaryResponse):
    standings: list[TournamentStandingResponse]
    rounds: list[TournamentRoundResponse]
