"""
Shared FastAPI dependency injection providers.

Responsibilities:
- Provide async DB session per request
- Provide current authenticated user from JWT
- Provide domain services to presentation layer
"""

from typing import AsyncGenerator
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database import async_session_factory
from infrastructure.security import decode_token
from domains.identity.infrastructure.models import UserModel

bearer_scheme = HTTPBearer()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async SQLAlchemy session, auto-close on completion."""
    async with async_session_factory() as session:
        yield session


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """Extract and validate user_id from the JWT access token."""
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token required",
        )

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing subject",
        )
    return user_id


async def require_admin(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> str:
    """Require the current user to be an unbanned admin."""
    user = await session.get(UserModel, UUID(user_id))
    if user is None or user.role != "admin" or user.banned_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return user_id
