"""Tournament domain entities."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from domains.tournaments.domain.value_objects import PairingResult, TournamentPlayerStatus, TournamentStatus, TournamentType


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Tournament:
    owner_id: UUID
    name: str
    time_control_name: str
    initial_time_ms: int
    increment_ms: int
    id: UUID = field(default_factory=uuid4)
    status: TournamentStatus = TournamentStatus.REGISTRATION
    tournament_type: TournamentType = TournamentType.SWISS
    entry_fee_cents: int = 0
    current_round: int = 0
    total_rounds: int = 0
    created_at: datetime = field(default_factory=utc_now)
    started_at: datetime | None = None
    finished_at: datetime | None = None


@dataclass
class TournamentPlayer:
    tournament_id: UUID
    user_id: UUID
    seed_rating: int
    score: float = 0.0
    status: TournamentPlayerStatus = TournamentPlayerStatus.ACTIVE
    joined_at: datetime = field(default_factory=utc_now)
    withdrawn_at: datetime | None = None


@dataclass
class TournamentRound:
    tournament_id: UUID
    round_number: int
    id: int | None = None
    created_at: datetime | None = None


@dataclass
class TournamentPairing:
    tournament_id: UUID
    round_number: int
    white_id: UUID
    black_id: UUID | None
    game_id: UUID | None = None
    result: PairingResult | None = None
    id: int | None = None
    created_at: datetime | None = None
