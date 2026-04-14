# ChessView Frontend

React + Vite frontend for ChessView.

## Package Manager

This frontend now uses Yarn Classic:

```powershell
yarn install --frozen-lockfile
yarn dev
yarn lint
yarn build
```

The committed lockfile is `yarn.lock`. `npm` may still work in a pinch, but Yarn is the supported workflow for this repo.

## Local Development

```powershell
cd C:\Users\Anek\chessview\frontend
yarn install --frozen-lockfile
yarn dev
```

The app runs at [http://localhost:5173](http://localhost:5173) and proxies `/api` and `/ws` to the backend.

## Docker

The frontend Docker image also installs dependencies with Yarn and runs:

```powershell
yarn dev --host 0.0.0.0 --port 5173
```

See the repo root [README](../README.md) for full-stack workflows.
