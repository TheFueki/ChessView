# ChessView

ChessView is a full-stack chess platform focused on live play, review, and study.

It combines server-authoritative multiplayer chess with replay, browser-local Stockfish analysis, puzzles, tournaments, profiles, ratings, and study tooling in one product surface.

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

## Screenshots

For the final release pass, capture and add these assets:

- `docs/screenshots/dashboard.png`
- `docs/screenshots/live-game.png`
- `docs/screenshots/analysis.png`
- `docs/screenshots/puzzles.png`
- `docs/screenshots/tournaments.png`

Once those files exist, link them here in the release README or on GitHub.

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
- domain map: `docs/domain-map.md`
- event contract: `docs/event-contract.md`
- release checklist: `docs/release-checklist.md`
- demo script: `docs/demo-script.md`

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

- local schema creation runs on backend startup
- starter puzzle data seeds automatically when the puzzle catalog is empty

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
just stack-up
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
uv run pytest tests
python -m compileall domains infrastructure shared tests app
```

Frontend:

```powershell
cd C:\Users\Anek\chessview\frontend
yarn lint
yarn build
```

## Demo Flow

Use this order for a short release demo:

1. Login
2. Play a live game in two browser sessions
3. Show premove / move flow
4. Finish the game
5. Open history and replay
6. Open analysis
7. Use the board editor
8. Import a PGN
9. Solve a puzzle
10. Open tournaments

There is also a dedicated script in `docs/demo-script.md`.

## Future Work

These are explicitly post-v1 ideas, not blockers:

- puzzle streaks and puzzle rating progression
- saved studies and persistent analysis sessions
- opening explorer
- notifications
- broader community or content surfaces

## Release Notes

ChessView v1 is intentionally focused on finishing well:

- correct auth and protected routing
- synchronized live gameplay and review surfaces
- real study and puzzle tooling
- coherent dev tooling and docs

This is the point to freeze features, tag the release, and ship.
