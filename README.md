# ChessView

ChessView is a full-stack chess platform focused on live play, review, and study.

It combines server-authoritative multiplayer chess with replay, browser-local Stockfish analysis, puzzles, tournaments, profiles, ratings, and study tooling in one product surface.

## Status

ChessView is frozen at `v1.0.1` as a stable refinement baseline for multi-engineer development.

What that means:

- the product surface is feature-complete for v1
- pull requests to `main` should stay incremental and reviewable
- repository guardrails and CI are part of the baseline, not optional follow-up work

## v1 Features

- JWT authentication with guarded frontend routes
- Live multiplayer chess with server-authoritative move validation
- Matchmaking with time controls, reconnect handling, timeout resolution, and abort policy
- Ratings, player profiles, and match history
- Replay with move stepping and synchronized local engine analysis
- Analysis board with board editor, PGN import, and sandbox move exploration
- Puzzle mode with starter content and attempt tracking
- Tournaments with pairings, standings, and round progression
- Avatar uploads and polished application shell/navigation

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand, react-router, react-chessboard, chess.js, Framer Motion
- Backend: FastAPI, SQLAlchemy async, PostgreSQL, python-chess, Uvicorn
- Tooling: Yarn, uv, Docker Compose, just

## Architecture

ChessView uses a domain-oriented backend and a feature-sliced frontend.

- Backend domains live under `backend/domains/` and keep domain, application, infrastructure, and presentation concerns separated.
- Frontend code lives under `frontend/src/` with app, pages, widgets, features, entities, and shared layers.
- Live gameplay remains server-authoritative.
- Browser-local Stockfish powers replay and study analysis without changing backend gameplay ownership.

More detail:

- architecture: `docs/architecture.md`
- contribution guide: `CONTRIBUTING.md`
- domain map: `docs/domain-map.md`
- event contract: `docs/event-contract.md`
- GitHub admin checklist: `docs/github-admin.md`
- scaling notes: `docs/scaling.md`
- backend notes: `backend/README.md`
- frontend notes: `frontend/README.md`

## Supported Workflows

ChessView supports two practical development workflows:

### A. Docker Compose

Use this when you want the full stack running together with the least setup friction.

```powershell
cd C:\Users\Anek\chessview
docker compose up --build
```

Endpoints:

- frontend: [http://localhost:5173](http://localhost:5173)
- backend API: [http://localhost:8000/api](http://localhost:8000/api)
- backend health: [http://localhost:8000/health](http://localhost:8000/health)

Notes:

- tracked Alembic migrations are applied on backend startup, and already-populated legacy dev databases are auto-adopted into the current tracked revision
- starter puzzle data seeds automatically when the puzzle catalog is empty
- once the stack is running, Docker-backed maintenance commands are available through the root `justfile`

### B. Local Split

Use this when you want the fastest inner-loop frontend/backend development.

1. Start PostgreSQL:

```powershell
cd C:\Users\Anek\chessview
docker compose up -d postgres
```

2. Start the backend:

```powershell
cd C:\Users\Anek\chessview\backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host localhost --port 8000
```

3. Start the frontend:

```powershell
cd C:\Users\Anek\chessview\frontend
yarn install --frozen-lockfile
yarn dev
```

Open [http://localhost:5173](http://localhost:5173).

## Package Manager

The frontend now uses Yarn Classic as the supported package manager.

Common commands:

```powershell
cd C:\Users\Anek\chessview\frontend
yarn dev
yarn lint
yarn build
```

If Yarn is not installed yet on Windows, install Yarn with your preferred package manager or activate it through Corepack when available.

## Just Commands

The root `justfile` provides the main day-to-day commands:

```powershell
just docker-up
just docker-down
just docker-rebuild
just stack-up
just docker-ps
just docker-logs-backend
just docker-backend-db-current
just docker-backend-db-upgrade
just docker-backend-db-check
just backend-smoke
just backend-dev
just frontend-dev
just frontend-lint
just frontend-build
just backend-tests
just check
```

If `just` is not installed yet on Windows:

```powershell
winget install jdx.just
```

```powershell
scoop install just
```

```powershell
choco install just
```

## Verification

Backend:

```powershell
cd C:\Users\Anek\chessview\backend
uv run python -m compileall app domains infrastructure shared tests
uv run alembic upgrade head
uv run alembic check
uv run python -c "import app.main"
uv run pytest tests
```

## Backend Migrations

Alembic is now the source of truth for backend schema changes.

Apply migrations:

```powershell
cd C:\Users\Anek\chessview\backend
uv run alembic upgrade head
```

If your local database predates the new Alembic workflow, start the backend once first so the legacy dev schema can be adopted into the tracked revision safely.

Docker Compose equivalents for a running stack:

```powershell
cd C:\Users\Anek\chessview
just docker-backend-db-current
just docker-backend-db-upgrade
just docker-backend-db-check
just docker-backend-db-revision MESSAGE="describe_change"
```

Create a new migration after changing SQLAlchemy models:

```powershell
cd C:\Users\Anek\chessview\backend
uv run alembic revision --autogenerate -m "describe_change"
```

Check that migrations and metadata still match:

```powershell
cd C:\Users\Anek\chessview\backend
uv run alembic check
```

For convenience, backend startup still applies tracked migrations automatically in Docker Compose and local dev. What changed is that startup no longer does `create_all` or ad hoc `ALTER TABLE` compatibility writes.

Frontend:

```powershell
cd C:\Users\Anek\chessview\frontend
yarn lint
yarn build
```

## Collaboration Guardrails

ChessView now includes:

- pull-request CI in `.github/workflows/pr-ci.yml`
- CODEOWNERS in `.github/CODEOWNERS`
- a pull request template and a minimal bug template
- contributor guidance in `CONTRIBUTING.md`
- a GitHub branch protection checklist in `docs/github-admin.md`

## Maintenance Rule

Treat this repository as a production-ready v1 baseline:

- no direct pushes to `main`
- no speculative architecture rewrites
- no feature creep disguised as cleanup
- prefer bug fixes, DevEx improvements, documentation clarity, and operational hardening
