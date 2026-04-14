"""
Identity application service.

Orchestrates domain logic for registration, login, token refresh, and profile queries.
Depends only on domain layer (entities, repository interface, exceptions).
Infrastructure details (JWT, hashing) are injected, not imported directly.
"""

from uuid import UUID

from domains.identity.domain.entities import User
from domains.identity.domain.exceptions import (
    DuplicateEmail,
    DuplicateUsername,
    InvalidCredentials,
    UserNotFound,
)
from domains.identity.domain.repository import AbstractUserRepository
from domains.identity.application.commands import (
    LoginUserCommand,
    RefreshTokenCommand,
    RegisterUserCommand,
)


class IdentityService:
    """Application service for the identity domain."""

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        hash_password,   # callable(str) -> str
        verify_password,  # callable(str, str) -> bool
        create_access_token,  # callable(str) -> str
        create_refresh_token,  # callable(str) -> str
        decode_token,     # callable(str) -> dict
    ) -> None:
        self._repo = user_repo
        self._hash_password = hash_password
        self._verify_password = verify_password
        self._create_access_token = create_access_token
        self._create_refresh_token = create_refresh_token
        self._decode_token = decode_token

    async def register(self, cmd: RegisterUserCommand) -> dict:
        """
        Register a new user.

        Returns auth payload with tokens and current user data.
        Raises DuplicateEmail/DuplicateUsername on conflict.
        """
        existing = await self._repo.get_by_email(cmd.email)
        if existing is not None:
            raise DuplicateEmail()
        existing = await self._repo.get_by_username(cmd.username)
        if existing is not None:
            raise DuplicateUsername()

        user = User(
            username=cmd.username,
            email=cmd.email,
            password_hash=self._hash_password(cmd.password),
        )
        user = await self._repo.create(user)

        return self._build_auth_response(user)

    async def login(self, cmd: LoginUserCommand) -> dict:
        """
        Authenticate a user.

        Returns auth payload with tokens and current user data.
        Raises InvalidCredentials on failure.
        """
        user = await self._repo.get_by_email(cmd.email)
        if user is None:
            raise InvalidCredentials()
        if not self._verify_password(cmd.password, user.password_hash):
            raise InvalidCredentials()

        return self._build_auth_response(user)

    async def refresh(self, cmd: RefreshTokenCommand) -> dict:
        """
        Rotate tokens using a valid refresh token.

        Returns new token pair. Raises InvalidCredentials if token invalid.
        """
        try:
            payload = self._decode_token(cmd.refresh_token)
        except Exception:
            raise InvalidCredentials()

        if payload.get("type") != "refresh":
            raise InvalidCredentials()

        user_id = payload.get("sub")
        if user_id is None:
            raise InvalidCredentials()

        return self._build_token_pair(user_id)

    async def get_profile(self, user_id: UUID) -> User:
        """
        Retrieve a user by ID.

        Raises UserNotFound if no match.
        """
        user = await self._repo.get_by_id(user_id)
        if user is None:
            raise UserNotFound()
        return user

    async def update_avatar(self, user_id: UUID, avatar_path: str | None) -> User:
        user = await self.get_profile(user_id)
        user.avatar_path = avatar_path
        return await self._repo.update(user)

    def _build_token_pair(self, user_id: str) -> dict:
        return {
            "access_token": self._create_access_token(user_id),
            "refresh_token": self._create_refresh_token(user_id),
            "token_type": "bearer",
        }

    def _build_auth_response(self, user: User) -> dict:
        payload = self._build_token_pair(str(user.id))
        payload["user"] = {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "rating": user.rating,
            "avatar_url": user.avatar_path,
            "created_at": user.created_at,
        }
        return payload
