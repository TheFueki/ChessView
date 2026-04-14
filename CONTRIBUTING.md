# Contributing to ChessView

ChessView is set up for small, reviewable pull requests against `main`.

## Workflow

1. Branch from the latest `main`.
2. Make focused changes in a short-lived branch.
3. Run the relevant checks before opening a PR.
4. Open a pull request to `main`.
5. Merge through GitHub after review and passing CI.

Do not push directly to `main`.

## Development Paths

ChessView supports both of these local workflows:

- Docker Compose: `docker compose up --build`
- Local split dev:
  - backend: `cd backend && uv sync && uv run uvicorn app.main:app --reload --host localhost --port 8000`
  - frontend: `cd frontend && yarn install --frozen-lockfile && yarn dev`

See the root [README](README.md) for the full setup details.

## Package Managers and Commands

- Frontend package manager: Yarn Classic
- Backend dependency manager: `uv`
- Common project commands live in the root `justfile`

Useful commands:

```powershell
just backend-smoke
just backend-tests
just frontend-lint
just frontend-build
just check
```

## Before Opening a PR

Run the checks that match your change:

```powershell
cd C:\Users\Anek\chessview\backend
uv run python -m compileall app domains infrastructure shared tests
uv run python -c "import app.main"
uv run pytest tests
```

```powershell
cd C:\Users\Anek\chessview\frontend
yarn install --frozen-lockfile
yarn lint
yarn build
```

Expect GitHub Actions to rerun these PR gates on `main`.

Important:

- A failing workflow on `push` is only a signal.
- GitHub blocks bad changes only when branch protection or repository rulesets require the checks on `main`.

## PR Expectations

- Keep PRs small enough to review in one sitting.
- Explain what changed, why, and how you tested it.
- Include screenshots when UI behavior changes.
- Call out docs, config, env, migration, or storage impact explicitly.
- Prefer follow-up PRs over mixing unrelated work into one branch.

## Branch Protection

Repository admins should configure branch protection on `main` using the checklist in [docs/github-admin.md](docs/github-admin.md).
