"""Ratings application service."""

from uuid import UUID

from domains.ratings.domain.entities import RatingUpdate
from domains.ratings.domain.repository import AbstractRatingRepository


class RatingService:
    """Coordinates Elo application for completed games."""

    def __init__(self, rating_repo: AbstractRatingRepository) -> None:
        self._repo = rating_repo

    async def apply_game_rating(self, game_id: UUID) -> RatingUpdate | None:
        return await self._repo.apply_game_rating(game_id)
