"""
Matchmaking application service.

Uses Redis for shared ephemeral queue state so multiple backend instances can
pair players from the same matchmaking pool.
"""

import random
import time
from dataclasses import dataclass
from uuid import UUID, uuid4

from domains.matchmaking.domain.entities import QueueEntry
from domains.matchmaking.domain.exceptions import AlreadyInQueue, NotInQueue
from infrastructure.redis import get_redis_client


@dataclass(frozen=True)
class MatchPair:
    """A successful pairing."""

    white_id: UUID
    black_id: UUID
    time_control_name: str
    initial_time_ms: int
    increment_ms: int


class MatchmakingService:
    """Application service for the matchmaking domain."""

    RATING_THRESHOLD: int = 200
    QUEUE_TTL_SECONDS: int = 30 * 60
    LOCK_TTL_SECONDS: int = 3

    def __init__(self, redis_client=None, clock_ms=None) -> None:
        self._redis_client = redis_client
        self._clock_ms = clock_ms or (lambda: int(time.time() * 1000))

    def _redis(self):
        return self._redis_client or get_redis_client()

    @staticmethod
    def _queue_key(time_control_name: str) -> str:
        return f"mm:queue:{time_control_name}"

    @staticmethod
    def _user_key(user_id: UUID) -> str:
        return f"mm:user:{user_id}"

    @staticmethod
    def _lock_key(time_control_name: str) -> str:
        return f"lock:matchmaking:{time_control_name}"

    async def join_queue(
        self,
        user_id: UUID,
        rating: int,
        time_control_name: str,
        initial_time_ms: int,
        increment_ms: int,
    ) -> int:
        redis = self._redis()
        user_key = self._user_key(user_id)
        if await redis.hgetall(user_key):
            raise AlreadyInQueue()

        joined_at_ms = self._clock_ms()
        queue_key = self._queue_key(time_control_name)
        await redis.hset(
            user_key,
            mapping={
                "rating": rating,
                "time_control_name": time_control_name,
                "initial_time_ms": initial_time_ms,
                "increment_ms": increment_ms,
                "joined_at_ms": joined_at_ms,
            },
        )
        await redis.expire(user_key, self.QUEUE_TTL_SECONDS)
        await redis.zadd(queue_key, {str(user_id): float(joined_at_ms)})
        await redis.expire(queue_key, self.QUEUE_TTL_SECONDS)
        rank = await redis.zrank(queue_key, str(user_id))
        return int(rank if rank is not None else await redis.zcard(queue_key) - 1) + 1

    async def leave_queue(self, user_id: UUID) -> None:
        redis = self._redis()
        user_key = self._user_key(user_id)
        entry = await self._load_entry(redis, user_id)
        if entry is None:
            raise NotInQueue()
        await redis.zrem(self._queue_key(entry.time_control_name), str(user_id))
        await redis.delete(user_key)

    async def try_match(self, user_id: UUID) -> MatchPair | None:
        redis = self._redis()
        entry = await self._load_entry(redis, user_id)
        if entry is None:
            return None

        token = str(uuid4())
        lock_key = self._lock_key(entry.time_control_name)
        acquired = await redis.set(lock_key, token, nx=True, ex=self.LOCK_TTL_SECONDS)
        if not acquired:
            return None

        try:
            entry = await self._load_entry(redis, user_id)
            if entry is None:
                return None
            best_match = await self._find_best_match(redis, entry)
            if best_match is None:
                return None

            await redis.zrem(self._queue_key(entry.time_control_name), str(user_id), str(best_match.user_id))
            await redis.delete(self._user_key(user_id), self._user_key(best_match.user_id))
        finally:
            await self._release_lock(redis, lock_key, token)

        if random.random() < 0.5:
            white_id, black_id = entry.user_id, best_match.user_id
        else:
            white_id, black_id = best_match.user_id, entry.user_id

        return MatchPair(
            white_id=white_id,
            black_id=black_id,
            time_control_name=entry.time_control_name,
            initial_time_ms=entry.initial_time_ms,
            increment_ms=entry.increment_ms,
        )

    async def _find_best_match(self, redis, entry: QueueEntry) -> QueueEntry | None:
        queue_key = self._queue_key(entry.time_control_name)
        candidate_ids = await redis.zrange(queue_key, 0, -1)
        best_match: QueueEntry | None = None
        best_diff = float("inf")
        best_joined_at = float("inf")
        for candidate_id in candidate_ids:
            if str(candidate_id) == str(entry.user_id):
                continue
            other = await self._load_entry(redis, UUID(str(candidate_id)))
            if other is None:
                await redis.zrem(queue_key, str(candidate_id))
                continue
            if other.user_id == entry.user_id:
                continue
            if (
                other.time_control_name != entry.time_control_name
                or other.initial_time_ms != entry.initial_time_ms
                or other.increment_ms != entry.increment_ms
            ):
                continue

            diff = abs(other.rating - entry.rating)
            joined_at = await self._joined_at(redis, other.user_id)
            if diff <= self.RATING_THRESHOLD and (diff < best_diff or (diff == best_diff and joined_at < best_joined_at)):
                best_diff = diff
                best_joined_at = joined_at
                best_match = other

        return best_match

    async def _load_entry(self, redis, user_id: UUID) -> QueueEntry | None:
        raw = await redis.hgetall(self._user_key(user_id))
        if not raw:
            return None
        return QueueEntry(
            user_id=user_id,
            rating=int(raw["rating"]),
            time_control_name=str(raw["time_control_name"]),
            initial_time_ms=int(raw["initial_time_ms"]),
            increment_ms=int(raw["increment_ms"]),
        )

    async def _joined_at(self, redis, user_id: UUID) -> float:
        raw = await redis.hgetall(self._user_key(user_id))
        if not raw:
            return float("inf")
        return float(raw.get("joined_at_ms", "inf"))

    async def _release_lock(self, redis, lock_key: str, token: str) -> None:
        await redis.eval(
            """
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            end
            return 0
            """,
            1,
            lock_key,
            token,
        )
