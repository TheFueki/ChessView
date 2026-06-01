# ChessView Frontend

React + Vite user frontend for ChessView.

Repository baseline: `v1.0.1`

## Package Manager

The frontend uses Yarn Classic:

```powershell
yarn install --frozen-lockfile
yarn dev
yarn lint
yarn test:ui-consistency
yarn build
```

The committed lockfile is `yarn.lock`.

## Local Development

```powershell
cd frontend
yarn install --frozen-lockfile
yarn dev
```

The app runs at <http://localhost:5173> and proxies `/api` and `/ws` to the backend.

The browser-facing backend URL is configured with `VITE_SERVER_URL` in the repository root `.env`.

Example local env values:

```powershell
VITE_SERVER_URL=http://localhost:8000
VITE_API_PROXY_TARGET=http://localhost:8000
VITE_WS_PROXY_TARGET=ws://localhost:8000
```

## Main Routes

- `/`: landing page when logged out, dashboard when logged in
- `/login`, `/register`: authentication
- `/lobby`: matchmaking entry point
- `/game/:gameId`: live game
- `/games/:gameId`: replay/review
- `/analysis`: local FEN/PGN/Stockfish analysis
- `/puzzles`: puzzle training
- `/tournaments`, `/tournaments/:tournamentId`: tournament flows
- `/scheduled-matches`: planned direct matches
- `/shop`, `/clubs`, `/otb-manager`: extended/demo surfaces

## Docker

The frontend Docker image installs dependencies with Yarn and runs:

```powershell
yarn dev --host 0.0.0.0 --port 5173
```

See the repository root [README](../README.md) for full-stack workflows.
