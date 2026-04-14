"""Tournament domain value objects."""

from enum import StrEnum


class TournamentStatus(StrEnum):
    REGISTRATION = "registration"
    ACTIVE = "active"
    FINISHED = "finished"


class PairingResult(StrEnum):
    WHITE_WINS = "1-0"
    BLACK_WINS = "0-1"
    DRAW = "1/2-1/2"
