"""
Matchmaking application service.

Owns the in-memory queue and pairing logic.
Returns a MatchPair on successful pairing.
"""

import random
from dataclasses import dataclass
from uuid import UUID

from domains.matchmaking.domain.entities import QueueEntry
from domains.matchmaking.domain.exceptions import AlreadyInQueue, NotInQueue


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

    _queue: list[QueueEntry] = []
    RATING_THRESHOLD: int = 200

    async def join_queue(
        self,
        user_id: UUID,
        rating: int,
        time_control_name: str,
        initial_time_ms: int,
        increment_ms: int,
    ) -> int:
        queue = type(self)._queue
        if any(entry.user_id == user_id for entry in queue):
            raise AlreadyInQueue()

        queue.append(
            QueueEntry(
                user_id=user_id,
                rating=rating,
                time_control_name=time_control_name,
                initial_time_ms=initial_time_ms,
                increment_ms=increment_ms,
            )
        )
        return len(queue)

    async def leave_queue(self, user_id: UUID) -> None:
        queue = type(self)._queue
        before = len(queue)
        type(self)._queue = [entry for entry in queue if entry.user_id != user_id]
        if len(type(self)._queue) == before:
            raise NotInQueue()

    async def try_match(self, user_id: UUID) -> MatchPair | None:
        queue = type(self)._queue
        entry = next((item for item in queue if item.user_id == user_id), None)
        if entry is None:
            return None

        best_match: QueueEntry | None = None
        best_diff = float("inf")
        for other in queue:
            if other.user_id == user_id:
                continue
            if (
                other.time_control_name != entry.time_control_name
                or other.initial_time_ms != entry.initial_time_ms
                or other.increment_ms != entry.increment_ms
            ):
                continue

            diff = abs(other.rating - entry.rating)
            if diff <= self.RATING_THRESHOLD and diff < best_diff:
                best_diff = diff
                best_match = other

        if best_match is None:
            return None

        type(self)._queue = [
            item for item in queue if item.user_id not in (user_id, best_match.user_id)
        ]

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
