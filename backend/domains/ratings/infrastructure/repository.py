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
from shared.time_controls import RatingSpeed, rating_speed_for_clock, rating_speed_for_time_control_name


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

        speed = self._rating_speed_for_game(game)
        rating_attr = self._rating_attr_for_speed(speed)
        white_before = getattr(white, rating_attr)
        black_before = getattr(black, rating_attr)
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

        setattr(white, rating_attr, white_after)
        setattr(black, rating_attr, black_after)

        game.white_rating_before = white_before
        game.black_rating_before = black_before
        game.white_rating_after = white_after
        game.black_rating_after = black_after
        game.rating_applied_at = datetime.now(timezone.utc)

        await self._session.commit()
        await self._session.refresh(game)

        return rating_update

    @staticmethod
    def _rating_speed_for_game(game: GameModel) -> RatingSpeed:
        initial_time_ms = getattr(game, "initial_time_ms", None)
        increment_ms = getattr(game, "increment_ms", None)
        if initial_time_ms is not None and increment_ms is not None and initial_time_ms > 0 and increment_ms >= 0:
            return rating_speed_for_clock(initial_time_ms, increment_ms)
        return rating_speed_for_time_control_name(getattr(game, "time_control_name", ""))

    @staticmethod
    def _rating_attr_for_speed(speed: RatingSpeed) -> str:
        return f"{speed.value}_rating"
