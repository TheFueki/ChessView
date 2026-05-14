"""Tournament domain value objects."""

from enum import StrEnum


class TournamentStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    REGISTRATION = "registration"
    REGISTRATION_OPEN = "registration_open"
    REGISTRATION_CLOSED = "registration_closed"
    ACTIVE = "active"
    RUNNING = "running"
    FINISHED = "finished"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class TournamentType(StrEnum):
    ARENA = "arena"
    SWISS = "swiss"
    OTB = "otb"


class TournamentPlayerStatus(StrEnum):
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"


class PairingResult(StrEnum):
    WHITE_WINS = "1-0"
    BLACK_WINS = "0-1"
    DRAW = "1/2-1/2"
