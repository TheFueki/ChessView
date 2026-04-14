"""
FastAPI application factory and lifespan management.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from infrastructure.database import close_db, init_db
from shared.middleware import register_middleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    logger.info("Starting ChessView - initializing database...")
    await init_db()
    logger.info("Database tables ready.")

    stop_event = asyncio.Event()
    from domains.game.presentation.runtime import run_game_monitor

    monitor_task = asyncio.create_task(run_game_monitor(stop_event))
    try:
        yield
    finally:
        stop_event.set()
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass
        await close_db()
        logger.info("Database engine disposed.")


def create_app() -> FastAPI:
    application = FastAPI(title="ChessView API", version="0.1.0", lifespan=lifespan)
    register_middleware(application)
    _register_static(application)
    _register_routers(application)
    _register_ws(application)
    _register_health(application)
    return application


def _register_routers(application: FastAPI) -> None:
    from domains.communication.presentation.router import router as communication_router
    from domains.game.presentation.router import router as game_router
    from domains.identity.presentation.router import router as identity_router
    from domains.puzzles.presentation.router import router as puzzle_router
    from domains.profiles.presentation.router import router as profile_router
    from domains.tournaments.presentation.router import router as tournament_router

    application.include_router(identity_router, prefix="/api/identity", tags=["identity"])
    application.include_router(profile_router, prefix="/api/profiles", tags=["profiles"])
    application.include_router(game_router, prefix="/api/games", tags=["games"])
    application.include_router(communication_router, prefix="/api/games", tags=["communication"])
    application.include_router(puzzle_router, prefix="/api/puzzles", tags=["puzzles"])
    application.include_router(tournament_router, prefix="/api/tournaments", tags=["tournaments"])


def _register_ws(application: FastAPI) -> None:
    from app.ws_entry import ws_endpoint

    application.add_api_websocket_route("/ws", ws_endpoint)


def _register_health(application: FastAPI) -> None:
    @application.get("/health", tags=["ops"])
    async def health():
        return {"status": "ok"}


def _register_static(application: FastAPI) -> None:
    storage_dir = Path(__file__).resolve().parents[1] / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    application.mount("/media", StaticFiles(directory=storage_dir), name="media")


app = create_app()
