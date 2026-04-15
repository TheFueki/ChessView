import pytest

from infrastructure.database_bootstrap import initialize_database
from infrastructure.database_migrations import to_migration_database_url


@pytest.mark.asyncio
async def test_initialize_database_runs_migrations_before_seeding(monkeypatch):
    calls: list[object] = []
    engine = object()

    def fake_register_models() -> None:
        calls.append("register")

    async def fake_run_database_migrations() -> None:
        calls.append("migrate")

    async def fake_seed_starter_puzzles(received_engine) -> None:
        calls.append(("seed", received_engine))

    monkeypatch.setattr("infrastructure.database_bootstrap.register_models", fake_register_models)
    monkeypatch.setattr("infrastructure.database_bootstrap.run_database_migrations", fake_run_database_migrations)
    monkeypatch.setattr("infrastructure.database_bootstrap.seed_starter_puzzles", fake_seed_starter_puzzles)

    await initialize_database(engine)

    assert calls == ["register", "migrate", ("seed", engine)]


def test_to_migration_database_url_rewrites_asyncpg_for_alembic():
    assert (
        to_migration_database_url("postgresql+asyncpg://user:password@db.example.invalid:5432/app")
        == "postgresql+psycopg://user:password@db.example.invalid:5432/app"
    )
