"""Explicit admin bootstrap helpers."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.config import settings
from domains.identity.infrastructure.models import UserModel


async def seed_first_admin(engine: AsyncEngine) -> None:
    """Promote one existing user when FIRST_ADMIN_EMAIL is explicitly configured."""
    if not settings.FIRST_ADMIN_EMAIL:
        return

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        result = await session.execute(
            select(UserModel).where(func.lower(UserModel.email) == settings.FIRST_ADMIN_EMAIL.lower())
        )
        user = result.scalar_one_or_none()
        if user is None or user.role == "admin":
            return
        user.role = "admin"
        await session.commit()
