"""Port for rating updates that span users and games."""

from abc import ABC, abstractmethod
from uuid import UUID

from domains.ratings.domain.entities import RatingUpdate


class AbstractRatingRepository(ABC):
    """Repository abstraction for applying ratings to a finished game."""

    @abstractmethod
    async def apply_game_rating(self, game_id: UUID) -> RatingUpdate | None:
        """Apply rating changes to a finished rated game if not yet processed."""
        ...
