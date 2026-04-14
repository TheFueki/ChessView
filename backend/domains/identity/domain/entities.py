"""
Identity domain entities.

Pure domain objects — no framework dependencies.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


@dataclass
class User:
    """Core user entity. Owns identity and rating."""

    id: UUID = field(default_factory=uuid4)
    username: str = ""
    email: str = ""
    password_hash: str = ""
    rating: int = 1200
    avatar_path: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
