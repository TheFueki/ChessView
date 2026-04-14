"""
Matchmaking WebSocket event handlers.

Handles: queue_join, queue_leave
Emits: queue_joined, match_found
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from shared.events import EventType, WSEnvelope
from shared.ws_manager import manager
from domains.matchmaking.application.services import MatchmakingService, MatchPair
from domains.matchmaking.domain.exceptions import AlreadyInQueue, NotInQueue
from domains.game.application.commands import CreateGameCommand, StartingRatings
from domains.game.application.services import GameService
from domains.game.infrastructure.repository import SqlAlchemyGameRepository
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository
from shared.time_controls import TIME_CONTROL_PRESETS

logger = logging.getLogger(__name__)

# Shared in-memory queue (single process is fine for MVP)
_service = MatchmakingService()


async def handle_queue_join(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Handle a queue_join event from a client."""
    uid = UUID(user_id)
    requested_time_control = envelope.payload.get("time_control", "5+0")
    if requested_time_control not in TIME_CONTROL_PRESETS:
        await manager.send_error(user_id, "INVALID_TIME_CONTROL", "Unsupported time control")
        return

    time_control = TIME_CONTROL_PRESETS[requested_time_control]

    # Fetch actual user rating from DB
    user_repo = SqlAlchemyUserRepository(session)
    user = await user_repo.get_by_id(uid)
    rating = user.rating if user else 1200

    try:
        position = await _service.join_queue(
            uid,
            rating,
            requested_time_control,
            time_control.initial_time_ms,
            time_control.increment_ms,
        )
    except AlreadyInQueue:
        await manager.send_error(user_id, "ALREADY_IN_QUEUE", "You are already in the queue")
        return

    await manager.send_to_user(
        user_id,
        EventType.QUEUE_JOINED,
        {"position": position, "time_control": requested_time_control},
    )

    # Attempt immediate pairing
    match = await _service.try_match(uid)
    if match is None:
        return

    white_user = await user_repo.get_by_id(match.white_id)
    black_user = await user_repo.get_by_id(match.black_id)

    # Create game record in DB
    game_repo = SqlAlchemyGameRepository(session)
    game_svc = GameService(game_repo)
    game = await game_svc.create_game(
        CreateGameCommand(
            white_id=match.white_id,
            black_id=match.black_id,
            time_control=time_control,
            starting_ratings=StartingRatings(
                white=white_user.rating if white_user else 1200,
                black=black_user.rating if black_user else 1200,
            ),
            rated=True,
        )
    )

    game_id = str(game.id)
    white_id = str(match.white_id)
    black_id = str(match.black_id)

    # Join both players to the game room
    manager.join_room(game_id, white_id)
    manager.join_room(game_id, black_id)

    white_info = {"id": white_id, "username": white_user.username if white_user else "?", "rating": white_user.rating if white_user else 1200}
    black_info = {"id": black_id, "username": black_user.username if black_user else "?", "rating": black_user.rating if black_user else 1200}

    # Send match_found to white
    await manager.send_to_user(white_id, EventType.MATCH_FOUND, {
        "game_id": game_id,
        "opponent": black_info,
        "color": "white",
        "time_control": match.time_control_name,
    })
    # Send match_found to black
    await manager.send_to_user(black_id, EventType.MATCH_FOUND, {
        "game_id": game_id,
        "opponent": white_info,
        "color": "black",
        "time_control": match.time_control_name,
    })

    logger.info("Match created: game_id=%s white=%s black=%s", game_id, white_id, black_id)


async def handle_queue_leave(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Handle a queue_leave event from a client."""
    try:
        await _service.leave_queue(UUID(user_id))
    except NotInQueue:
        await manager.send_error(user_id, "NOT_IN_QUEUE", "You are not in the queue")
