"""Rating domain entities."""

from dataclasses import dataclass


@dataclass(frozen=True)
class RatingChange:
    """Rating transition for a single player."""

    before: int
    after: int

    @property
    def delta(self) -> int:
        return self.after - self.before


@dataclass(frozen=True)
class RatingUpdate:
    """Atomic rating result for both players in a finished game."""

    white: RatingChange
    black: RatingChange
