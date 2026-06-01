"""Admin API DTOs."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AdminUserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    rating: int
    role: str
    banned_at: datetime | None
    created_at: datetime


class AdminUserPatchRequest(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=32)
    email: str | None = None
    rating: int | None = Field(None, ge=0)
    coins: int | None = Field(None, ge=0)


class AdminUserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str
    password: str = Field(min_length=6, max_length=128)
    rating: int = Field(default=1200, ge=0)
    role: str = Field(default="user", pattern="^(user|admin)$")
    coins: int = Field(default=2000, ge=0)


class AdminRoleRequest(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


class AdminAuditLogResponse(BaseModel):
    id: UUID
    actor_user_id: UUID
    action: str
    target_type: str
    target_id: str
    payload: dict
    created_at: datetime


class AdminTournamentResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    time_control_name: str
    initial_time_ms: int
    increment_ms: int
    status: str
    tournament_type: str
    entry_fee_cents: int
    current_round: int
    total_rounds: int
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class AdminTournamentCreateRequest(BaseModel):
    owner_id: UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    time_control_name: str = Field(default="rapid", max_length=20)
    initial_time_ms: int = Field(default=600000, ge=1)
    increment_ms: int = Field(default=5000, ge=0)
    status: str = "draft"
    tournament_type: str = "swiss"
    entry_fee_cents: int = Field(default=0, ge=0)
    total_rounds: int = Field(default=3, ge=1)


class AdminTournamentPatchRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    time_control_name: str | None = Field(None, max_length=20)
    initial_time_ms: int | None = Field(None, ge=1)
    increment_ms: int | None = Field(None, ge=0)
    status: str | None = None
    tournament_type: str | None = None
    entry_fee_cents: int | None = Field(None, ge=0)
    current_round: int | None = Field(None, ge=0)
    total_rounds: int | None = Field(None, ge=1)


class AdminScheduledMatchResponse(BaseModel):
    id: UUID
    tournament_id: UUID | None
    white_player_id: UUID | None
    black_player_id: UUID | None
    creator_user_id: UUID
    invited_user_id: UUID | None
    starts_at: datetime
    status: str
    game_id: UUID | None
    created_at: datetime


class AdminScheduledMatchPatchRequest(BaseModel):
    starts_at: datetime | None = None
    status: str | None = None
    white_player_id: UUID | None = None
    black_player_id: UUID | None = None


class AdminGameResponse(BaseModel):
    id: UUID
    white_id: UUID
    black_id: UUID
    status: str
    result: str | None
    rated: bool
    started_at: datetime
    ended_at: datetime | None


class AdminGamePatchRequest(BaseModel):
    status: str | None = None
    result: str | None = None
    termination_reason: str | None = None


class AdminShopItem(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=80)
    price: int = Field(ge=0)
    type: str
    rarity: str
    description: str = Field(default="", max_length=300)
    image_url: str | None = None
    consumable: bool = False


class AdminShopItemPatchRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    price: int | None = Field(None, ge=0)
    type: str | None = None
    rarity: str | None = None
    description: str | None = Field(None, max_length=300)
    image_url: str | None = None
    consumable: bool | None = None
