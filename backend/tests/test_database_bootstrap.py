import pytest

from domains.admin.infrastructure import seed as admin_seed
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

    async def fake_seed_first_admin(received_engine) -> None:
        calls.append(("admin", received_engine))

    async def fake_seed_demo_tournaments(received_engine) -> None:
        calls.append(("demo", received_engine))

    async def fake_seed_default_shop_items(received_engine) -> None:
        calls.append(("shop", received_engine))

    monkeypatch.setattr("infrastructure.database_bootstrap.register_models", fake_register_models)
    monkeypatch.setattr("infrastructure.database_bootstrap.run_database_migrations", fake_run_database_migrations)
    monkeypatch.setattr("infrastructure.database_bootstrap.seed_starter_puzzles", fake_seed_starter_puzzles)
    monkeypatch.setattr("infrastructure.database_bootstrap.seed_default_shop_items", fake_seed_default_shop_items)
    monkeypatch.setattr("infrastructure.database_bootstrap.seed_demo_tournaments", fake_seed_demo_tournaments)
    monkeypatch.setattr("infrastructure.database_bootstrap.seed_first_admin", fake_seed_first_admin)

    await initialize_database(engine)

    assert calls == ["register", "migrate", ("seed", engine), ("shop", engine), ("demo", engine), ("admin", engine)]


def test_to_migration_database_url_rewrites_asyncpg_for_alembic():
    assert (
        to_migration_database_url("postgresql+asyncpg://user:password@db.example.invalid:5432/app")
        == "postgresql+psycopg://user:password@db.example.invalid:5432/app"
    )


@pytest.mark.asyncio
async def test_seed_first_admin_creates_predictable_local_admin(monkeypatch):
    added_users = []

    class FakeResult:
        def scalar_one_or_none(self):
            return None

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def execute(self, _statement):
            return FakeResult()

        def add(self, user):
            added_users.append(user)

        async def commit(self):
            pass

    def fake_sessionmaker(_engine, expire_on_commit=False):
        assert expire_on_commit is False
        return lambda: FakeSession()

    monkeypatch.setattr(admin_seed, "async_sessionmaker", fake_sessionmaker)
    monkeypatch.setattr(admin_seed.settings, "SEED_ADMIN_EMAIL", "admin@chessview.app")
    monkeypatch.setattr(admin_seed.settings, "SEED_ADMIN_USERNAME", "admin")
    monkeypatch.setattr(admin_seed.settings, "SEED_ADMIN_PASSWORD", "admin123")
    monkeypatch.setattr(admin_seed, "hash_password", lambda password: f"hashed:{password}")

    await admin_seed.seed_first_admin(object())

    assert len(added_users) == 1
    assert added_users[0].email == "admin@chessview.app"
    assert added_users[0].username == "admin"
    assert added_users[0].password == "hashed:admin123"
    assert added_users[0].role == "admin"
