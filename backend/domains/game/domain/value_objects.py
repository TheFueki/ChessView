"""
Game domain value objects.
"""

from dataclasses import dataclass
from enum import StrEnum


class Color(StrEnum):
    WHITE = "white"
    BLACK = "black"


class GameStatus(StrEnum):
    ACTIVE = "active"
    CHECKMATE = "checkmate"
    STALEMATE = "stalemate"
    DRAW = "draw"
    RESIGNED = "resigned"
    TIMEOUT = "timeout"
    ABORTED = "aborted"


class GameResult(StrEnum):
    WHITE_WINS = "1-0"
    BLACK_WINS = "0-1"
    DRAW = "1/2-1/2"


@dataclass(frozen=True, slots=True)
class StartingRatings:
    """Rating snapshot captured at game creation time."""

    white: int
    black: int
