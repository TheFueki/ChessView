import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from infrastructure.database import close_db, init_db
from shared.middleware import register_middleware
from domains.identity.domain.exceptions import IdentityException, UserNotFound

logger = logging.getLogger(__name__)

if settings.OAUTHLIB_INSECURE_TRANSPORT:
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "true")

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
    application = FastAPI(
        title="ChessView API", 
        version="1.0.1", 
        lifespan=lifespan
    )
    
    @application.middleware("http")
    async def catch_all_middleware(request: Request, call_next):
        try:
            print(f"DEBUG: Request to {request.url.path}")
            return await call_next(request)
        except Exception as e:
            import traceback
            print("!!! MIDDLEWARE CRASH !!!")
            print(traceback.format_exc()) 
            return JSONResponse(status_code=500, content={"err": str(e)})

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_middleware(application)
    _register_static(application)
    _register_exception_handlers(application)
    _register_routers(application)
    _register_ws(application)
    _register_health(application)
    
    return application

def _register_routers(application: FastAPI) -> None:
    from domains.admin.presentation.router import router as admin_router
    from domains.communication.presentation.router import router as communication_router
    from domains.game.presentation.router import router as game_router
    from domains.identity.presentation.router import router as identity_router
    from domains.payments.presentation.router import router as payments_router
    from domains.puzzles.presentation.router import router as puzzle_router
    from domains.profiles.presentation.router import router as profile_router
    from domains.scheduled_matches.presentation.router import router as scheduled_match_router
    from domains.shop.presentation.router import router as shop_router
    from domains.tournaments.presentation.router import router as tournament_router

    v1 = "/api/v1"

    application.include_router(admin_router, prefix=f"{v1}/admin", tags=["admin"])
    application.include_router(identity_router, prefix=f"{v1}/identity", tags=["identity"])
    application.include_router(profile_router, prefix=f"{v1}/profiles", tags=["profiles"])
    application.include_router(game_router, prefix=f"{v1}/games", tags=["games"])
    application.include_router(communication_router, prefix=f"{v1}/chat", tags=["communication"])
    application.include_router(puzzle_router, prefix=f"{v1}/puzzles", tags=["puzzles"])
    application.include_router(payments_router, prefix=f"{v1}/payments", tags=["payments"])
    application.include_router(shop_router, prefix=f"{v1}/shop", tags=["shop"])
    application.include_router(scheduled_match_router, prefix=f"{v1}/scheduled-matches", tags=["scheduled-matches"])
    application.include_router(tournament_router, prefix=f"{v1}/tournaments", tags=["tournaments"])

def _register_exception_handlers(application: FastAPI) -> None:
    @application.exception_handler(IdentityException)
    async def identity_exception_handler(request: Request, exc: IdentityException):
        if isinstance(exc, UserNotFound):
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Requested resource was not found", "code": "NOT_FOUND"},
            )
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": str(exc)},
        )

    @application.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        import traceback
        logger.error(f"GLOBAL ERROR: {str(exc)}")
        logger.error(traceback.format_exc())
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An unexpected server error occurred",
                "message": str(exc),
                "code": "INTERNAL_ERROR"
            },
        )
        
def _register_ws(application: FastAPI) -> None:
    from app.ws_entry import ws_endpoint
    application.add_api_websocket_route("/ws", ws_endpoint)

def _register_health(application: FastAPI) -> None:
    @application.get("/health", tags=["ops"])
    async def health():
        return {"status": "ok", "version": "1.0.1"}

def _register_static(application: FastAPI) -> None:
    base_storage = settings.resolved_storage_dir
    base_storage.mkdir(parents=True, exist_ok=True)
    
    (base_storage / "avatars").mkdir(parents=True, exist_ok=True)
    (base_storage / "banners").mkdir(parents=True, exist_ok=True)

    application.mount("/media", StaticFiles(directory=str(base_storage)), name="media")

app = create_app()
