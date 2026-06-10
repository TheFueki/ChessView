set shell := ["powershell.exe", "-NoProfile", "-Command"]

docker := "New-Item -ItemType Directory -Force .docker | Out-Null; if (!(Test-Path .docker\\config.json)) { Copy-Item .docker\\config.example.json .docker\\config.json }; $env:DOCKER_CONFIG=(Resolve-Path .docker).Path; docker compose"

default:
    just --list

docker-ps:
    {{docker}} ps

docker-logs:
    {{docker}} logs -f

docker-logs-backend:
    {{docker}} logs -f backend

docker-logs-frontend:
    {{docker}} logs -f frontend

docker-up:
    {{docker}} up -d

docker-down:
    {{docker}} down

docker-rebuild:
    {{docker}} up --build -d

stack-up:
    {{docker}} up --build

docker-restart-backend:
    {{docker}} restart backend

docker-backend-shell:
    {{docker}} exec backend sh

docker-frontend-shell:
    {{docker}} exec frontend sh

docker-backend-db-current:
    {{docker}} exec backend uv run alembic current

docker-backend-db-upgrade:
    {{docker}} exec backend uv run alembic upgrade head

docker-backend-db-check:
    {{docker}} exec backend uv run alembic check

docker-backend-db-revision MESSAGE="describe_change":
    {{docker}} exec backend uv run alembic revision --autogenerate -m "{{MESSAGE}}"

backend-dev:
    Set-Location backend; uv sync; uv run uvicorn app.main:app --reload --host localhost --port 8000

backend-db-upgrade:
    Set-Location backend; uv sync; uv run alembic upgrade head

backend-db-check:
    Set-Location backend; uv sync; uv run alembic check

backend-db-revision message:
    Set-Location backend; uv sync; uv run alembic revision --autogenerate -m "{{message}}"

frontend-dev:
    Set-Location frontend; yarn install --frozen-lockfile; yarn dev

frontend-lint:
    Set-Location frontend; yarn lint

frontend-i18n:
    Set-Location frontend; yarn test:i18n

frontend-ui-consistency:
    Set-Location frontend; yarn test:ui-consistency

frontend-tests:
    Set-Location frontend; yarn test:unit

frontend-build:
    Set-Location frontend; yarn build

admin-typecheck:
    Set-Location admin-frontend; yarn typecheck

admin-lint:
    Set-Location admin-frontend; yarn lint

admin-tests:
    Set-Location admin-frontend; yarn test:unit

admin-build:
    Set-Location admin-frontend; yarn build

docker-config:
    {{docker}} config

e2e-tests:
    yarn test:e2e

backend-smoke:
    Set-Location backend; uv run python -m compileall app domains infrastructure shared tests; uv run python -c "import app.main"

backend-tests:
    Set-Location backend; uv run pytest tests

backend-coverage:
    Set-Location backend; uv run pytest tests --cov=app --cov=domains --cov=infrastructure --cov=shared --cov-report=term-missing --cov-report=json:coverage.json

check:
    Set-Location backend; uv run python -m compileall app domains infrastructure shared tests; uv run python -c "import app.main"; uv run pytest tests; Set-Location ..\frontend; yarn lint; yarn build

check-ci:
    Set-Location backend; uv sync; uv run python -m compileall app domains infrastructure shared tests; uv run alembic upgrade head; uv run alembic check; uv run python -c "import app.main"; uv run pytest tests; Set-Location ..\frontend; yarn install --frozen-lockfile; yarn lint; yarn test:i18n; yarn test:ui-consistency; yarn test:unit; yarn build; Set-Location ..\admin-frontend; yarn install --frozen-lockfile; yarn typecheck; yarn lint; yarn test:unit; yarn build; Set-Location ..; {{docker}} config; yarn test:e2e
