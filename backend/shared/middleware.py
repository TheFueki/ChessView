"""
Shared middleware registration.

Responsibilities:
- CORS configuration
- Global exception handlers
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from shared.exception_handlers import register_exception_handlers


def register_middleware(app: FastAPI) -> None:
    """Attach all middleware to the FastAPI application."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
