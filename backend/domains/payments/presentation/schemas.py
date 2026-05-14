"""Payment API DTOs."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PaymentIntentResponse(BaseModel):
    id: UUID
    user_id: UUID
    tournament_id: UUID | None
    scheduled_match_id: UUID | None = None
    subject_type: str
    amount_cents: int
    currency: str
    status: str
    scenario: str | None = None
    reserved_until: datetime | None = None
    metadata: dict
    created_at: datetime
    updated_at: datetime | None = None


class PaymentSimulationRequest(BaseModel):
    scenario: str = Field(pattern="^(success|failed|pending|cancelled|expired|refunded|disputed)$")
