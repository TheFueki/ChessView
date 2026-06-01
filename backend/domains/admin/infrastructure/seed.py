"""Explicit admin bootstrap helpers."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.config import settings
from domains.identity.infrastructure.models import UserModel
from infrastructure.security import hash_password, verify_password


def _password_matches(plain: str, hashed: str) -> bool:
    try:
        return verify_password(plain, hashed)
    except ValueError:
        return False


async def seed_first_admin(engine: AsyncEngine) -> None:
    """Promote configured admins and ensure local admin credentials exist."""
    seed_email = settings.SEED_ADMIN_EMAIL.strip().lower()
    seed_username = settings.SEED_ADMIN_USERNAME.strip() or "admin"
    seed_password = settings.SEED_ADMIN_PASSWORD

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        changed = False

        if settings.FIRST_ADMIN_EMAIL:
            result = await session.execute(
                select(UserModel).where(func.lower(UserModel.email) == settings.FIRST_ADMIN_EMAIL.lower())
            )
            first_admin = result.scalar_one_or_none()
            if first_admin is not None and first_admin.role != "admin":
                first_admin.role = "admin"
                changed = True

        if seed_email and seed_password:
            result = await session.execute(select(UserModel).where(func.lower(UserModel.email) == seed_email))
            seeded_admin = result.scalar_one_or_none()
            if seeded_admin is None:
                result = await session.execute(select(UserModel).where(func.lower(UserModel.username) == seed_username.lower()))
                seeded_admin = result.scalar_one_or_none()

            if seeded_admin is None:
                session.add(
                    UserModel(
                        username=seed_username,
                        email=seed_email,
                        password=hash_password(seed_password),
                        rating=1800,
                        bullet_rating=1800,
                        blitz_rating=1800,
                        rapid_rating=1800,
                        classical_rating=1800,
                        coins=5000,
                        role="admin",
                        banned_at=None,
                    )
                )
                changed = True
            else:
                if seeded_admin.email.lower() != seed_email:
                    seeded_admin.email = seed_email
                    changed = True
                if seeded_admin.role != "admin":
                    seeded_admin.role = "admin"
                    changed = True
                if seeded_admin.banned_at is not None:
                    seeded_admin.banned_at = None
                    changed = True
                if not _password_matches(seed_password, seeded_admin.password):
                    seeded_admin.password = hash_password(seed_password)
                    changed = True

        if changed:
            await session.commit()
