set shell := ["powershell.exe", "-NoProfile", "-Command"]

default:
    just --list

docker-up:
    docker compose up -d

stack-up:
    docker compose up --build

backend-dev:
    Set-Location backend; uv sync; uv run uvicorn app.main:app --reload --host localhost --port 8000

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
