# ChessView Backend

FastAPI backend for ChessView.

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
python -m compileall domains infrastructure shared tests app
```

## Notes

- local development creates tables on startup
- dev compatibility helpers run during startup bootstrap
- starter puzzle data is seeded automatically when needed

See the repo root [README](../README.md) for Docker Compose and full-stack workflows.
