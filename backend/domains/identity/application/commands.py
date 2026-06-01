"""
Identity application-layer command DTOs.

Plain dataclasses carrying input data for service operations.
No business logic here   just data transfer.
"""

from dataclasses import dataclass
from uuid import UUID

@dataclass(frozen=True)
class RegisterUserCommand:
    """Input for user registration."""
    username: str
    email: str
    password: str

@dataclass(frozen=True)
class OAuthUserCommand:
    email: str
    username: str
    
@dataclass(frozen=True)
class LoginUserCommand:
    """Input for user login."""
    email: str
    password: str


@dataclass(frozen=True)
class RefreshTokenCommand:
    """Input for token refresh."""
    refresh_token: str


@dataclass(frozen=True)
class RequestPasswordResetCommand:
    email: str
    frontend_url: str


@dataclass(frozen=True)
class CompletePasswordResetCommand:
    token: str
    password: str


@dataclass(frozen=True)
class UpdateProfileCommand:
    user_id: UUID
    username: str | None = None
    bio: str | None = None
