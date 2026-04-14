"""
Matchmaking domain value objects.
"""

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class MatchResult:
    """The outcome of a successful pairing."""

    game_id: UUID
    white_id: UUID
    black_id: UUID
