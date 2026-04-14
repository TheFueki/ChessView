"""
Communication domain entities.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID


@dataclass
class ChatMessage:
    """A single chat message within a game."""

    id: int | None = None  # DB-assigned serial
    game_id: UUID = field(default_factory=lambda: UUID(int=0))
    user_id: UUID = field(default_factory=lambda: UUID(int=0))
    content: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
