# ChessView Frontend

React + Vite frontend for ChessView.

Repository version: `1.0.0`

## Package Manager

This frontend now uses Yarn Classic:

```powershell
yarn install --frozen-lockfile
yarn dev
yarn lint
yarn build
```

The committed lockfile is `yarn.lock`. Yarn is the supported workflow for this repo.

## Local Development

```powershell
cd C:\Users\Anek\ChessViewVentie\ChessView\frontend
yarn install --frozen-lockfile
yarn dev
```

The app runs at [http://localhost:5173](http://localhost:5173) and proxies `/api` and `/ws` to the backend.

The browser-facing backend URL is configured with `VITE_SERVER_URL` in the repo root `.env`.

Example local env values:

```powershell
VITE_SERVER_URL=http://localhost:8000
VITE_API_PROXY_TARGET=http://localhost:8000
VITE_WS_PROXY_TARGET=ws://localhost:8000
```

## Docker

The frontend Docker image also installs dependencies with Yarn and runs:

```powershell
yarn dev --host 0.0.0.0 --port 5173
```

See the repo root [README](../README.md) for full-stack workflows.
