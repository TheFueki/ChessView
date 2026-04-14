"""
Async SQLAlchemy engine and session factory.

Responsibilities:
- Create async engine from DATABASE_URL
- Provide async session factory for DI
- Provide shared declarative base for all ORM models
- Expose lifecycle hooks delegated to bootstrap helpers
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    # TODO: Tune pool_size, max_overflow for production
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models across domains."""
    pass


async def init_db() -> None:
    """Create the development schema and backfill compatibility columns."""
    from infrastructure.database_bootstrap import initialize_database

    await initialize_database(engine)


async def close_db() -> None:
    """Dispose the engine on application shutdown."""
    await engine.dispose()
