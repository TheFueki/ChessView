# ChessView Backend

FastAPI backend for ChessView.

Repository version: `1.0.0`

## Local Run

```powershell
cd C:\Users\Anek\chessview\backend
uv sync
uv run uvicorn app.main:app --reload --host localhost --port 8000
```

## Tests

```powershell
cd C:\Users\Anek\chessview\backend
uv run pytest tests
uv run python -m compileall app domains infrastructure shared tests
uv run python -c "import app.main"
```

## Notes

- local development creates tables on startup
- dev compatibility helpers run during startup bootstrap
- starter puzzle data is seeded automatically when needed
- the current runtime model is single-instance; see `../docs/scaling.md` for the next scaling step

See the repo root [README](../README.md) for Docker Compose and full-stack workflows.
