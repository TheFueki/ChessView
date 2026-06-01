import secrets
from dataclasses import dataclass
from uuid import UUID, uuid4
from datetime import datetime

from domains.identity.application.commands import (
    CompletePasswordResetCommand,
    LoginUserCommand,
    RefreshTokenCommand,
    RegisterUserCommand,
    RequestPasswordResetCommand,
    UpdateProfileCommand,
    OAuthUserCommand,
)
from domains.identity.domain.entities import User
from domains.identity.domain.exceptions import (
    DuplicateEmail,
    DuplicateUsername,
    InvalidCredentials,
    UserNotFound,
)
from domains.identity.domain.repository import AbstractUserRepository


@dataclass(frozen=True)
class PasswordResetTicket:
    email: str
    token: str
    reset_url: str


class IdentityService:
    """
    Application service for the identity domain.
    Orchestrates domain logic for registration, login, profile queries, and OAuth.
    """

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        hash_password,  
        verify_password, 
        create_access_token,
        create_refresh_token, 
        create_password_reset_token,
        decode_token,   
    ) -> None:
        self._repo = user_repo
        self._hash_password = hash_password
        self._verify_password = verify_password
        self._create_access_token = create_access_token
        self._create_refresh_token = create_refresh_token
        self._create_password_reset_token = create_password_reset_token
        self._decode_token = decode_token

    async def register(self, cmd: RegisterUserCommand) -> dict:
        """Register a new user via email and password."""
        await self._check_uniqueness(cmd.email, cmd.username)

        user = User(
            id=uuid4(),
            username=cmd.username,
            email=cmd.email,
            password_hash=self._hash_password(cmd.password),
        )
        user = await self._repo.create(user)
        return self._build_auth_response(user)

    async def login(self, cmd: LoginUserCommand) -> dict:
        """Authenticate a user. Raises InvalidCredentials on failure."""
        user = await self._repo.get_by_email(cmd.email)
        if user is None or not self._verify_password(cmd.password, user.password_hash):
            raise InvalidCredentials()

        return self._build_auth_response(user)

    async def oauth_flow(self, cmd: OAuthUserCommand) -> dict:
        """
        Handle seamless OAuth authentication.
        Creates a profile if it doesn't exist, otherwise logs in.
        """
        user = await self._repo.get_by_email(cmd.email)

        if user is None:
            final_username = cmd.username
            if await self._repo.get_by_username(final_username):
                final_username = f"{cmd.username}_{secrets.token_hex(2)}"

            random_pwd = secrets.token_urlsafe(32)
            
            user = User(
                id=uuid4(),
                username=final_username,
                email=cmd.email,
                password_hash=self._hash_password(random_pwd),
            )
            user = await self._repo.create(user)

        return self._build_auth_response(user)

    async def refresh(self, cmd: RefreshTokenCommand) -> dict:
        """Rotate tokens using a valid refresh token."""
        try:
            payload = self._decode_token(cmd.refresh_token)
        except Exception:
            raise InvalidCredentials()

        if payload.get("type") != "refresh":
            raise InvalidCredentials()

        user_id = payload.get("sub")
        if user_id is None:
            raise InvalidCredentials()

        return self._build_token_pair(str(user_id))

    async def request_password_reset(self, cmd: RequestPasswordResetCommand) -> PasswordResetTicket | None:
        user = await self._repo.get_by_email(cmd.email)
        if user is None:
            return None

        token = self._create_password_reset_token(str(user.id))
        reset_token = f"reset:{token}"
        reset_url = f"{cmd.frontend_url.rstrip('/')}/reset-password?token={reset_token}"
        return PasswordResetTicket(email=user.email, token=reset_token, reset_url=reset_url)

    async def complete_password_reset(self, cmd: CompletePasswordResetCommand) -> None:
        token = cmd.token.removeprefix("reset:")
        try:
            payload = self._decode_token(token)
        except Exception:
            raise InvalidCredentials()

        if payload.get("type") != "password_reset":
            raise InvalidCredentials()

        user_id = payload.get("sub")
        if user_id is None:
            raise InvalidCredentials()

        user = await self._repo.get_by_id(UUID(str(user_id)))
        if user is None:
            raise UserNotFound()

        user.password_hash = self._hash_password(cmd.password)
        await self._repo.update(user)

    async def get_profile(self, user_id: UUID) -> User:
        user = await self._repo.get_by_id(user_id)
        if user is None:
            raise UserNotFound()
        return user

    async def update_avatar(self, user_id: UUID, avatar_path: str | None) -> User:
        user = await self.get_profile(user_id)
        user.avatar_path = avatar_path
        return await self._repo.update(user)
    
    async def update_profile(self, cmd: UpdateProfileCommand) -> User:
        user = await self.get_profile(cmd.user_id)

        if cmd.username and cmd.username != user.username:
            if await self._repo.get_by_username(cmd.username):
                raise DuplicateUsername()
            user.username = cmd.username

        if cmd.bio is not None:
            user.bio = cmd.bio
            
        return await self._repo.update(user)

    async def _check_uniqueness(self, email: str, username: str) -> None:
        if await self._repo.get_by_email(email):
            raise DuplicateEmail()
        if await self._repo.get_by_username(username):
            raise DuplicateUsername()

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
            "rating": getattr(user, "rating", 800),
            "role": getattr(user, "role", "user"),
            "banned_at": getattr(user, "banned_at", None),
            "bio": getattr(user, "bio", None),  
            "avatar_url": user.avatar_path,
            "created_at": getattr(user, "created_at", datetime.utcnow()),
            "global_rank": 0  
        }
        return payload
