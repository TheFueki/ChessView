"""Database bootstrap orchestration for local startup."""

from sqlalchemy.ext.asyncio import AsyncEngine

from infrastructure.database_migrations import run_database_migrations
from infrastructure.database_registry import register_models
from domains.admin.infrastructure.seed import seed_first_admin
from domains.puzzles.infrastructure.seed import seed_starter_puzzles
from domains.shop.infrastructure.seed import seed_default_shop_items
from domains.tournaments.infrastructure.seed import seed_demo_tournaments


async def initialize_database(engine: AsyncEngine) -> None:
    """Apply migrations and seed baseline data needed by local environments."""
    register_models()
    await run_database_migrations()
    await seed_starter_puzzles(engine)
    await seed_default_shop_items(engine)
    await seed_demo_tournaments(engine)
    await seed_first_admin(engine)
