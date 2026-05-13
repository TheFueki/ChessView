"""Face verification API DTOs."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FaceVerificationEnrollRequest(BaseModel):
    device_label: str | None = None
    consent: bool


class FaceVerificationProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    provider: str
    status: str
    device_label: str | None
    consented_at: datetime
    created_at: datetime
    updated_at: datetime | None


class FaceVerificationStartRequest(BaseModel):
    tournament_id: UUID | None = None
    scheduled_match_id: UUID | None = None


class FaceVerificationSubmitRequest(BaseModel):
    scenario: str | None = None
    token: str | None = None


class FaceVerificationSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    game_id: UUID | None
    tournament_id: UUID | None
    scheduled_match_id: UUID | None
    status: str
    confidence: float | None
    reason: str | None
    provider: str
    created_at: datetime
    completed_at: datetime | None
