# ChessView Backend

FastAPI backend for ChessView.

Repository version: `1.0.1`

## Local Run

```powershell
cd C:\Users\Anek\chessview\backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host localhost --port 8000
```

Backend startup also runs `alembic upgrade head` automatically so Docker Compose and day-to-day local boot still stay low-friction. The schema source of truth is now the checked-in Alembic history, not startup `create_all`.

## Database Migrations

Apply migrations:

```powershell
cd C:\Users\Anek\chessview\backend
uv run alembic upgrade head
```

If your local database predates Alembic, start the backend once first so the legacy dev schema can be adopted into the tracked revision safely.

Generate a migration after changing ORM models:

```powershell
cd C:\Users\Anek\chessview\backend
uv run alembic revision --autogenerate -m "describe_change"
```

Check for model drift against the migrated database:

```powershell
cd C:\Users\Anek\chessview\backend
uv run alembic check
```

Docker Compose equivalents for a running stack:

```powershell
cd C:\Users\Anek\chessview
just docker-backend-db-current
just docker-backend-db-upgrade
just docker-backend-db-check
just docker-backend-db-revision MESSAGE="describe_change"
```

## Tests

```powershell
cd C:\Users\Anek\chessview\backend
uv run alembic upgrade head
uv run alembic check
uv run pytest tests
uv run python -m compileall app domains infrastructure shared tests
uv run python -c "import app.main"
```

## Notes

- existing local databases created before Alembic are auto-adopted into the current tracked revision on first startup
- starter puzzle data is seeded automatically when needed
- the current runtime model is single-instance; see `../docs/scaling.md` for the next scaling step

See the repo root [README](../README.md) for Docker Compose and full-stack workflows.
