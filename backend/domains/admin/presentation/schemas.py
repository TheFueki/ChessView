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
