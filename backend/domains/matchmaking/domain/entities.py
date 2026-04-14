"""Matchmaking domain entities."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID


@dataclass
class QueueEntry:
    """A player waiting in the matchmaking queue."""

    user_id: UUID
    rating: int
    time_control_name: str
    initial_time_ms: int
    increment_ms: int
    joined_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
