"""Database bootstrap orchestration for local startup."""

from sqlalchemy.ext.asyncio import AsyncEngine

from infrastructure.database import Base
from infrastructure.database_compat import apply_dev_compatibility_migrations
from infrastructure.database_registry import register_models
from domains.puzzles.infrastructure.seed import seed_starter_puzzles


async def initialize_database(engine: AsyncEngine) -> None:
    """Create schema and apply local compatibility shims for dev databases."""
    register_models()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.run_sync(apply_dev_compatibility_migrations)
    await seed_starter_puzzles(engine)
