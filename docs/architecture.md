# ChessView Architecture

## Overview

ChessView is a browser-based chess product with three major responsibilities:

- live competitive play
- post-game review and analysis
- study tooling such as puzzles, board editing, and PGN import

The stack is intentionally split between:

- a server-authoritative backend for game state, ratings, profiles, tournaments, and persistence
- a frontend that owns interaction, presentation, and browser-local Stockfish analysis

## System Shape

```text
Browser (React SPA)
  -> HTTPS REST API
  -> WebSocket connection for live events
  -> WebRTC peer media between players
  -> Local Stockfish worker for replay/study analysis

FastAPI backend
  -> domain/application/infrastructure/presentation modules
  -> PostgreSQL persistence
  -> room-based WebSocket fanout for live games
```

## Backend Architecture

The backend is organized by domain under `backend/domains/`.

Each domain follows the same shape:

- `domain/`: entities, value objects, policies, pure rules, repository interfaces
- `application/`: commands, services, orchestration
- `infrastructure/`: SQLAlchemy models, repository implementations, storage helpers
- `presentation/`: REST routers, WebSocket handlers, schemas, serializers

Key domains:

- `identity`: auth, current user, avatar flows
- `game`: live games, clocks, history, replay data
- `matchmaking`: queueing and game creation
- `profiles`: player profile read models
- `ratings`: Elo updates and rating snapshots
- `communication`: chat
- `tournaments`: tournament lifecycle, pairings, standings
- `puzzles`: puzzle catalog and attempt tracking

Shared infrastructure lives under `backend/infrastructure/` and `backend/shared/`.

Important current backend choices:

- live chess state remains server-authoritative
- persistence models describe storage concerns, not product policy
- database bootstrap applies tracked Alembic migrations before seeding starter puzzle data
- repositories use explicit mapping helpers instead of generic magic or copy-paste walls

## Frontend Architecture

The frontend lives in `frontend/src/` and follows a feature-sliced structure:

- `app/`: providers, router, app-wide concerns
- `pages/`: route-level surfaces
- `widgets/`: composite UI blocks
- `features/`: focused interactive capabilities
- `entities/`: domain-facing frontend state and types
- `shared/`: UI primitives, utilities, API clients, chess helpers

Important frontend choices:

- auth is bootstrapped once at app start and guarded at the router layer
- live game flow stays separate from replay, analysis, and puzzles
- browser-local Stockfish is used for review and study, not for backend move authority
- navigation and shell patterns are shared across the product surfaces

## Live Game Ownership

The server is the single source of truth for gameplay.

Flow:

1. Client sends a move event.
2. Backend validates the move against stored game state.
3. Backend persists the new state and broadcasts the updated game room state.
4. Clients render from server state rather than optimistic local commits.

This keeps clocks, results, reconnect behavior, and move legality authoritative.

## Analysis Ownership

Replay and study analysis are intentionally local to the browser.

- replay uses finished game positions
- analysis workspace uses the currently displayed sandbox or editor position
- puzzle mode validates moves against stored solution lines
- Stockfish worker output is fenced to the current FEN so stale results do not leak between positions

This preserves backend simplicity while still giving players strong study tools.

## Deployment Model

Supported workflows:

- Docker Compose for the full stack
- local split development for faster iteration

Development topology:

- frontend on `localhost:5173`
- backend on `localhost:8000`
- postgres on `localhost:5432`

The frontend dev server proxies `/api` and `/ws` to the backend.

## Why This Architecture Fits v1

This structure keeps the product shippable without over-engineering:

- clean enough to extend
- explicit enough to own
- practical enough to run locally and demo easily

That balance is exactly what ChessView v1 needs.
