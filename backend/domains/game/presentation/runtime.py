"""Realtime runtime helpers for authoritative game lifecycle monitoring."""

import asyncio
import logging
from uuid import uuid4

from infrastructure.database import async_session_factory
from infrastructure.redis import INSTANCE_ID, get_redis_client
from shared.events import EventType
from shared.ws_manager import manager
from domains.game.application.services import GameService
from domains.game.infrastructure.repository import SqlAlchemyGameRepository
from domains.game.presentation.ws_handler import _game_over_payload
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository
from domains.ratings.application.services import RatingService
from domains.ratings.infrastructure.repository import SqlAlchemyRatingRepository
from domains.scheduled_matches.tournament import ensure_scheduled_matches_for_round
from domains.tournaments.application.services import TournamentService
from domains.tournaments.infrastructure.repository import SqlAlchemyTournamentRepository

logger = logging.getLogger(__name__)


GAME_MONITOR_LOCK_KEY = "lock:game-monitor"
RELEASE_LOCK_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
end
return 0
"""


async def acquire_game_monitor_lock(redis, token: str, ttl_seconds: int = 5) -> bool:
    """Acquire the distributed game monitor lock."""
    return bool(await redis.set(GAME_MONITOR_LOCK_KEY, token, nx=True, ex=ttl_seconds))


async def release_game_monitor_lock(redis, token: str) -> bool:
    """Release the game monitor lock only if this token still owns it."""
    return bool(await redis.eval(RELEASE_LOCK_SCRIPT, 1, GAME_MONITOR_LOCK_KEY, token))


async def run_game_monitor(stop_event: asyncio.Event, poll_interval_seconds: float = 1.0) -> None:
    """Finish timed-out or auto-aborted games in the background."""
    while not stop_event.is_set():
        redis = get_redis_client()
        lock_token = f"{INSTANCE_ID}:{uuid4()}"
        lock_acquired = False
        try:
            lock_acquired = await acquire_game_monitor_lock(redis, lock_token)
            if not lock_acquired:
                pass
            else:
                async with async_session_factory() as session:
                    game_repo = SqlAlchemyGameRepository(session)
                    game_service = GameService(game_repo)
                    finished_games = await game_service.monitor_active_games()
                    if finished_games:
                        rating_service = RatingService(SqlAlchemyRatingRepository(session))
                        tournament_service = TournamentService(
                            tournament_repo=SqlAlchemyTournamentRepository(session),
                            user_repo=SqlAlchemyUserRepository(session),
                            game_repo=game_repo,
                            game_service=game_service,
                        )
                        for game in finished_games:
                            rating_update = await rating_service.apply_game_rating(game.id)
                            tournament = await tournament_service.sync_game_result(game.id)
                            if tournament is not None:
                                await ensure_scheduled_matches_for_round(
                                    session,
                                    tournament_id=tournament.id,
                                    round_number=tournament.current_round,
                                    creator_user_id=tournament.owner_id,
                                )
                            await manager.broadcast_to_room(
                                str(game.id),
                                EventType.GAME_OVER,
                                _game_over_payload(game, rating_update, game.termination_reason or game.status),
                            )
        except Exception:
            logger.exception("Game monitor iteration failed")
        finally:
            if lock_acquired:
                await release_game_monitor_lock(redis, lock_token)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll_interval_seconds)
        except asyncio.TimeoutError:
            continue
