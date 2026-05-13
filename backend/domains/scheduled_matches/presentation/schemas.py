"""Scheduled match API DTOs."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ScheduledMatchCreateRequest(BaseModel):
    invited_user_id: UUID | None = None
    starts_at: datetime
    expires_at: datetime | None = None
    metadata: dict = {}


class ScheduledMatchRescheduleRequest(BaseModel):
    starts_at: datetime
    expires_at: datetime | None = None


class ScheduledMatchResponse(BaseModel):
    id: UUID
    tournament_id: UUID | None
    round_id: int | None
    pairing_id: int | None
    white_player_id: UUID | None
    black_player_id: UUID | None
    creator_user_id: UUID
    invited_user_id: UUID | None
    starts_at: datetime
    expires_at: datetime | None
    status: str
    game_id: UUID | None
    metadata: dict
    created_at: datetime
    updated_at: datetime | None
