# ChessView Backend

FastAPI backend for ChessView.

Repository baseline: `v1.0.1`

The backend loads configuration from the repository root `.env` when commands are run from `backend/`. By default, local split development uses PostgreSQL on `localhost:5432`, and `STORAGE_DIR=storage` resolves to `backend/storage`.

## Local Run

```powershell
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host localhost --port 8000
```

Backend startup also applies tracked Alembic migrations. The checked-in Alembic history is the schema source of truth.

Example requests:

```powershell
Invoke-RestMethod http://localhost:8000/health

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8000/api/v1/identity/register `
  -ContentType "application/json" `
  -Body '{"username":"alice","email":"alice@example.com","password":"Password123!"}'
```

## Database Migrations

Apply migrations:

```powershell
cd backend
uv run alembic upgrade head
```

Generate a migration after changing ORM models:

```powershell
cd backend
uv run alembic revision --autogenerate -m "describe_change"
```

Check for model drift against the migrated database:

```powershell
cd backend
uv run alembic check
```

Docker Compose equivalents for a running stack:

```powershell
just docker-backend-db-current
just docker-backend-db-upgrade
just docker-backend-db-check
just docker-backend-db-revision MESSAGE="describe_change"
```

## Tests

```powershell
cd backend
uv run python -m compileall app domains infrastructure shared tests
uv run alembic upgrade head
uv run alembic check
uv run python -c "import app.main"
uv run pytest tests
```

## Notes

- starter puzzle data is seeded automatically when needed
- current runtime is single-instance; see [scaling notes](../docs/scaling.md)
- payment flows use an emulator, not a real payment provider
- local media is stored under `backend/storage`

See the repository root [README](../README.md) for Docker Compose and full-stack workflows.
