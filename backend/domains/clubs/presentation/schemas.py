"""Pydantic schemas for club APIs."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


ClubVisibility = Literal["public", "private"]
ClubRole = Literal["owner", "member"]


class ClubOwnerResponse(BaseModel):
    id: UUID
    username: str
    rating: int
    avatar_url: str | None = None


class ClubResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str
    visibility: ClubVisibility
    owner_id: UUID
    owner: ClubOwnerResponse | None
    member_count: int
    viewer_is_member: bool
    viewer_role: ClubRole | None
    created_at: datetime
    updated_at: datetime | None = None


class ClubCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=500)
    visibility: ClubVisibility = "public"


class ClubPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    visibility: ClubVisibility | None = None
