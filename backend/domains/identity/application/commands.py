"""
Identity application-layer command DTOs.

Plain dataclasses carrying input data for service operations.
No business logic here — just data transfer.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class RegisterUserCommand:
    """Input for user registration."""
    username: str
    email: str
    password: str


@dataclass(frozen=True)
class LoginUserCommand:
    """Input for user login."""
    email: str
    password: str


@dataclass(frozen=True)
class RefreshTokenCommand:
    """Input for token refresh."""
    refresh_token: str
