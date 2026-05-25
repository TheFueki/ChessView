"""
Game application-layer command DTOs.
"""

from dataclasses import dataclass
from uuid import UUID

from domains.game.domain.value_objects import StartingRatings
from shared.time_controls import TimeControl


@dataclass(frozen=True, slots=True)
class CreateGameCommand:
    """Explicit input for creating a new game."""

    white_id: UUID
    black_id: UUID
    time_control: TimeControl
    starting_ratings: StartingRatings
    rated: bool = True


@dataclass(frozen=True, slots=True)
class MakeMoveCommand:
    """Input for making a chess move."""

    game_id: UUID
    user_id: UUID
    uci: str  # e.g. "e2e4"


@dataclass(frozen=True, slots=True)
class ResignCommand:
    """Input for resigning a game."""

    game_id: UUID
    user_id: UUID


@dataclass(frozen=True, slots=True)
class IdentityVerificationFailureCommand:
    """Input for stopping a game after a failed identity verification."""

    game_id: UUID
    user_id: UUID


@dataclass(frozen=True, slots=True)
class OfferDrawCommand:
    """Input for offering a draw."""

    game_id: UUID
    user_id: UUID


@dataclass(frozen=True, slots=True)
class AcceptDrawCommand:
    """Input for accepting a draw."""

    game_id: UUID
    user_id: UUID


@dataclass(frozen=True, slots=True)
class DeclineDrawCommand:
    """Input for declining a draw."""

    game_id: UUID
    user_id: UUID
