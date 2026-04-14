"""Product policy rules for live games."""

from shared.time_controls import DEFAULT_TIME_CONTROL

MEANINGFUL_START_MOVE_COUNT = 2
DEFAULT_DISCONNECT_GRACE_SECONDS = 20
DEFAULT_GAME_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
DEFAULT_INITIAL_RATING = 1200


def is_meaningfully_started(move_count: int) -> bool:
    return move_count >= MEANINGFUL_START_MOVE_COUNT
