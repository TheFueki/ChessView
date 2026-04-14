"""SQLAlchemy implementation of the rating repository."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.game.domain.value_objects import GameStatus
from domains.game.infrastructure.models import GameModel
from domains.identity.infrastructure.models import UserModel
from domains.ratings.domain.entities import RatingChange, RatingUpdate
from domains.ratings.domain.repository import AbstractRatingRepository
from domains.ratings.domain.services import calculate_rating_update


class SqlAlchemyRatingRepository(AbstractRatingRepository):
    """Applies a finished game's rating update in one DB transaction."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def apply_game_rating(self, game_id: UUID) -> RatingUpdate | None:
        game_stmt = select(GameModel).where(GameModel.id == game_id)
        game_result = await self._session.execute(game_stmt)
        game = game_result.scalar_one_or_none()
        if game is None or not game.rated or game.result is None:
            return None

        if game.white_rating_after is not None and game.black_rating_after is not None:
            return RatingUpdate(
                white=RatingChange(before=game.white_rating_before, after=game.white_rating_after),
                black=RatingChange(before=game.black_rating_before, after=game.black_rating_after),
            )

        if game.status == GameStatus.ACTIVE:
            return None

        user_stmt = select(UserModel).where(UserModel.id.in_([game.white_id, game.black_id]))
        user_result = await self._session.execute(user_stmt)
        users = {user.id: user for user in user_result.scalars().all()}
        white = users.get(game.white_id)
        black = users.get(game.black_id)
        if white is None or black is None:
            return None

        white_before = game.white_rating_before or white.rating
        black_before = game.black_rating_before or black.rating
        rating_update = calculate_rating_update(
            rated=game.rated,
            status=game.status,
            result=game.result,
            white_before=white_before,
            black_before=black_before,
        )
        if rating_update is None:
            return None

        white_after = rating_update.white.after
        black_after = rating_update.black.after

        white.rating = white_after
        black.rating = black_after

        game.white_rating_before = white_before
        game.black_rating_before = black_before
        game.white_rating_after = white_after
        game.black_rating_after = black_after
        game.rating_applied_at = datetime.now(timezone.utc)

        await self._session.commit()
        await self._session.refresh(game)

        return rating_update
