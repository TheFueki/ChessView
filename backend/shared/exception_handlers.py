"""Centralized exception mapping for HTTP and WebSocket boundaries."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request

from domains.communication.domain.exceptions import MessageTooLong
from domains.game.domain.exceptions import GameAccessDenied, GameNotActive, GameNotFound, IllegalMove, NotYourTurn
from domains.identity.domain.exceptions import (
    DuplicateEmail,
    DuplicateUsername,
    InvalidCredentials,
    UserNotFound,
)
from domains.matchmaking.domain.exceptions import AlreadyInQueue, NotInQueue
from domains.puzzles.domain.exceptions import PuzzleNotFound
from domains.tournaments.domain.exceptions import (
    InvalidTournamentConfiguration,
    TournamentAlreadyJoined,
    TournamentForbidden,
    TournamentNotFound,
    TournamentOwnerCannotLeave,
    TournamentPlayerNotFound,
    TournamentRegistrationClosed,
    TournamentRoundNotReady,
    TournamentStartRequirementsNotMet,
)

logger = logging.getLogger(__name__)

ExceptionMapping = tuple[tuple[type[Exception], ...], int, str, str]

EXCEPTION_MAPPINGS: tuple[ExceptionMapping, ...] = (
    ((DuplicateEmail,), status.HTTP_409_CONFLICT, "DUPLICATE_EMAIL", "Email already registered"),
    ((DuplicateUsername,), status.HTTP_409_CONFLICT, "DUPLICATE_USERNAME", "Username already taken"),
    ((InvalidCredentials,), status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid credentials"),
    ((UserNotFound, GameNotFound), status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Requested resource was not found"),
    ((IllegalMove,), status.HTTP_400_BAD_REQUEST, "ILLEGAL_MOVE", "That move is not legal in the current position"),
    ((NotYourTurn,), status.HTTP_409_CONFLICT, "NOT_YOUR_TURN", "It is not your turn"),
    ((GameNotActive,), status.HTTP_409_CONFLICT, "GAME_NOT_ACTIVE", "The game is no longer active"),
    ((GameAccessDenied,), status.HTTP_403_FORBIDDEN, "GAME_ACCESS_DENIED", "You cannot act on this game"),
    ((AlreadyInQueue,), status.HTTP_409_CONFLICT, "ALREADY_IN_QUEUE", "You are already in the queue"),
    ((NotInQueue,), status.HTTP_409_CONFLICT, "NOT_IN_QUEUE", "You are not currently in the queue"),
    ((MessageTooLong,), status.HTTP_400_BAD_REQUEST, "MESSAGE_TOO_LONG", "Chat messages cannot exceed 500 characters"),
    ((PuzzleNotFound,), status.HTTP_404_NOT_FOUND, "PUZZLE_NOT_FOUND", "Puzzle not found"),
    ((TournamentNotFound, TournamentPlayerNotFound), status.HTTP_404_NOT_FOUND, "TOURNAMENT_NOT_FOUND", "Tournament data was not found"),
    ((TournamentAlreadyJoined,), status.HTTP_409_CONFLICT, "TOURNAMENT_ALREADY_JOINED", "You have already joined this tournament"),
    ((TournamentRegistrationClosed,), status.HTTP_409_CONFLICT, "TOURNAMENT_REGISTRATION_CLOSED", "Tournament registration is closed"),
    ((TournamentForbidden, TournamentOwnerCannotLeave), status.HTTP_403_FORBIDDEN, "TOURNAMENT_FORBIDDEN", "You cannot perform that tournament action"),
    ((TournamentStartRequirementsNotMet, TournamentRoundNotReady), status.HTTP_409_CONFLICT, "TOURNAMENT_NOT_READY", "The tournament cannot advance yet"),
    ((InvalidTournamentConfiguration,), status.HTTP_400_BAD_REQUEST, "INVALID_TOURNAMENT_CONFIGURATION", "Tournament configuration is invalid"),
)


def _match_mapping(exc: Exception) -> ExceptionMapping | None:
    for exception_types, http_status, code, message in EXCEPTION_MAPPINGS:
        if isinstance(exc, exception_types):
            return exception_types, http_status, code, message
    return None


def map_exception_to_http(exc: Exception) -> tuple[int, dict[str, Any]] | None:
    mapping = _match_mapping(exc)
    if mapping is None:
        return None

    _, http_status, code, message = mapping
    return http_status, {"detail": message, "code": code}


def map_exception_to_ws_error(exc: Exception) -> tuple[str, str] | None:
    mapping = _match_mapping(exc)
    if mapping is None:
        return None

    _, _, code, message = mapping
    return code, message


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def handle_http_exception(_: Request, exc: HTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        code = exc.headers.get("X-Error-Code") if exc.headers else None
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": detail, "code": code},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_exception(_: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Validation failed for this request",
                "code": "VALIDATION_ERROR",
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(request: Request, exc: Exception):
        mapped_response = map_exception_to_http(exc)
        if mapped_response is not None:
            http_status, payload = mapped_response
            return JSONResponse(status_code=http_status, content=payload)

        logger.exception("Unhandled HTTP exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "An unexpected server error occurred",
                "code": "INTERNAL_ERROR",
            },
        )
