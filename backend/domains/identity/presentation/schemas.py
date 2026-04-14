"""
Pydantic request/response schemas for the identity REST API.

These DTOs live in the presentation layer — they are NOT domain entities.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# --- Request schemas ---

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# --- Response schemas ---

class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: str
    rating: int
    avatar_url: str | None = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserProfileResponse | None = None


class PublicProfileResponse(BaseModel):
    id: str
    username: str
    rating: int
    avatar_url: str | None = None
