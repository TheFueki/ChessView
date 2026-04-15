set shell := ["powershell.exe", "-NoProfile", "-Command"]

default:
    just --list

docker-ps:
    docker compose ps

docker-logs:
    docker compose logs -f

docker-logs-backend:
    docker compose logs -f backend

docker-logs-frontend:
    docker compose logs -f frontend

docker-up:
    docker compose up -d

docker-down:
    docker compose down

docker-rebuild:
    docker compose up --build -d

stack-up:
    docker compose up --build

docker-restart-backend:
    docker compose restart backend

docker-backend-shell:
    docker compose exec backend sh

docker-frontend-shell:
    docker compose exec frontend sh

docker-backend-db-current:
    docker compose exec backend uv run alembic current

docker-backend-db-upgrade:
    docker compose exec backend uv run alembic upgrade head

docker-backend-db-check:
    docker compose exec backend uv run alembic check

docker-backend-db-revision MESSAGE="describe_change":
    docker compose exec backend uv run alembic revision --autogenerate -m "{{MESSAGE}}"

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

frontend-build:
    Set-Location frontend; yarn build

backend-smoke:
    Set-Location backend; uv run python -m compileall app domains infrastructure shared tests; uv run python -c "import app.main"

backend-tests:
    Set-Location backend; uv run pytest tests

check:
    Set-Location backend; uv run python -m compileall app domains infrastructure shared tests; uv run python -c "import app.main"; uv run pytest tests; Set-Location ..\frontend; yarn lint; yarn build
