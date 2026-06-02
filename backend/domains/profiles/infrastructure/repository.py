"""SQLAlchemy profile read repository."""

from uuid import UUID
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from domains.game.domain.value_objects import GameResult, GameStatus
from domains.game.infrastructure.models import GameModel, MoveModel
from domains.identity.infrastructure.models import UserModel
from domains.profiles.domain.entities import ProfileGamePreview, ProfilePlayer, ProfileSummary
from domains.profiles.domain.repository import AbstractProfileRepository
from shared.time_controls import DISPLAY_RATING_SPEEDS, RatingSpeed, public_rating_categories, rating_for_user, rating_speed_for_clock, rating_speed_for_time_control_name

UNKNOWN_PLAYER_USERNAME = "?"
UNKNOWN_PLAYER_RATING = 1200


class SqlAlchemyProfileRepository(AbstractProfileRepository):
    """Builds profile read models from users and games."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_profile_summary(self, user_id: UUID, recent_game_limit: int = 8) -> ProfileSummary | None:
        user_stmt = select(UserModel).where(UserModel.id == user_id)
        user_result = await self._session.execute(user_stmt)
        user = user_result.scalar_one_or_none()
        if user is None:
            return None

        game_condition = or_(GameModel.white_id == user_id, GameModel.black_id == user_id)
        games_stmt = select(GameModel).where(game_condition).order_by(GameModel.started_at.desc())
        games_result = await self._session.execute(games_stmt)
        games = list(games_result.scalars().all())

        completed_games = [game for game in games if game.status not in {GameStatus.ACTIVE, GameStatus.ABORTED}]
        wins, losses, draws = self._summarize_results(user_id, completed_games)
        games_played = len(completed_games)

        recent_games = games[:recent_game_limit]
        category_ratings = self._category_ratings_for_user(user)
        ratings = self._ratings_by_speed(user_id, category_ratings, completed_games)
        user_ids = {user_id}
        for game in recent_games:
            user_ids.add(game.white_id)
            user_ids.add(game.black_id)

        players = await self._build_player_lookup(user_ids)
        move_counts = await self._get_move_counts([game.id for game in recent_games])

        previews: list[ProfileGamePreview] = []
        for game in recent_games:
            player_color = "white" if game.white_id == user_id else "black"
            opponent_id = game.black_id if player_color == "white" else game.white_id

            previews.append(
                ProfileGamePreview(
                    id=str(game.id),
                    white=players.get(game.white_id) or self._unknown_player(game.white_id),
                    black=players.get(game.black_id) or self._unknown_player(game.black_id),
                    opponent=players.get(opponent_id) or self._unknown_player(opponent_id),
                    player_color=player_color,
                    time_control_name=game.time_control_name,
                    result=game.result,
                    status=game.status,
                    termination_reason=game.termination_reason,
                    move_count=move_counts.get(game.id, 0),
                    started_at=game.started_at,
                    ended_at=game.ended_at,
                    rated=game.rated,
                    rating_delta=self._rating_delta_for_user(game, player_color),
                )
            )

        win_rate = round((wins / games_played) * 100, 1) if games_played else 0.0
        #                                      
        rank = await self.get_user_rank(user.rating)

        return ProfileSummary(
            id=str(user.id),
            username=user.username,
            rating=user.rapid_rating,
            avatar_url=self._avatar_url(user.avatar_path),
            created_at=user.created_at,
            games_played=games_played,
            wins=wins,
            losses=losses,
            draws=draws,
            win_rate=win_rate,
            ratings=ratings,
            recent_games=previews,
            global_rank=rank,
            coins=user.coins,
        )

    async def get_top_profiles(self, limit: int, category: RatingSpeed | None = None) -> list[ProfileSummary]:
        rating_column = self._rating_column_for_speed(category)
        stmt = (
            select(
                UserModel,
                func.count(GameModel.id).filter(
                    and_(
                        GameModel.status != GameStatus.ACTIVE,
                        GameModel.status != GameStatus.ABORTED
                    )
                ).label("total_games"),
                func.count(GameModel.id).filter(
                    or_(
                        and_(GameModel.white_id == UserModel.id, GameModel.result == GameResult.WHITE_WINS),
                        and_(GameModel.black_id == UserModel.id, GameModel.result == GameResult.BLACK_WINS)
                    )
                ).label("wins"),
                func.count(GameModel.id).filter(
                    GameModel.result == GameResult.DRAW
                ).label("draws")
            )
            .outerjoin(GameModel, or_(UserModel.id == GameModel.white_id, UserModel.id == GameModel.black_id))
            .group_by(UserModel.id)
            .order_by(rating_column.desc())
            .limit(limit)
        )
        
        result = await self._session.execute(stmt)
        rows = result.all()

        top_profiles = []
        for index, row in enumerate(rows):
            user, total, wins, draws = row
            losses = total - wins - draws
            wr = round((wins / total * 100), 1) if total > 0 else 0.0

            top_profiles.append(
                ProfileSummary(
                    id=str(user.id),
                    username=user.username,
                    rating=rating_for_user(user, category or RatingSpeed.RAPID),
                    avatar_url=self._avatar_url(user.avatar_path),
                    created_at=user.created_at,
                    games_played=total,
                    wins=wins,
                    losses=losses,
                    draws=draws,
                    win_rate=wr,
                    ratings=public_rating_categories(user),
                    recent_games=[],
                    global_rank=index + 1,
                    coins=user.coins,
                )
            )

        return top_profiles

    async def search_players(self, query: str, limit: int = 10) -> list[ProfilePlayer]:
        stmt = (
            select(UserModel)
            .where(UserModel.username.ilike(f"%{query}%"))
            .order_by(UserModel.username.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        players = []
        for user in result.scalars().all():
            players.append(
                ProfilePlayer(
                    id=str(user.id),
                    username=user.username,
                    rating=user.rapid_rating,
                    avatar_url=self._avatar_url(user.avatar_path),
                    ratings=public_rating_categories(user),
                )
            )
        return players

    async def get_user_rank(self, rating: int, category: RatingSpeed | None = None) -> int:
        rating_column = self._rating_column_for_speed(category)
        stmt = select(func.count(UserModel.id)).where(rating_column > rating)
        result = await self._session.execute(stmt)
        count = result.scalar() or 0
        return count + 1

    async def _get_move_counts(self, game_ids: list[UUID]) -> dict[UUID, int]:
        if not game_ids:
            return {}
        stmt = (
            select(MoveModel.game_id, func.count(MoveModel.id))
            .where(MoveModel.game_id.in_(game_ids))
            .group_by(MoveModel.game_id)
        )
        result = await self._session.execute(stmt)
        return {game_id: count for game_id, count in result.all()}

    async def _build_player_lookup(self, user_ids: set[UUID]) -> dict[UUID, ProfilePlayer]:
        player_stmt = select(UserModel).where(UserModel.id.in_(list(user_ids)))
        player_result = await self._session.execute(player_stmt)
        return {
            player.id: ProfilePlayer(
                id=str(player.id),
                username=player.username,
                rating=player.rapid_rating,
                avatar_url=self._avatar_url(player.avatar_path),
                ratings=public_rating_categories(player),
            )
            for player in player_result.scalars().all()
        }

    @staticmethod
    def _summarize_results(user_id: UUID, completed_games: list[GameModel]) -> tuple[int, int, int]:
        wins, losses, draws = 0, 0, 0
        for game in completed_games:
            if game.result == GameResult.DRAW:
                draws += 1
            elif (game.result == GameResult.WHITE_WINS and game.white_id == user_id) or (
                game.result == GameResult.BLACK_WINS and game.black_id == user_id
            ):
                wins += 1
            elif game.result is not None:
                losses += 1
        return wins, losses, draws

    @staticmethod
    def _rating_delta_for_user(game: GameModel, player_color: str) -> int | None:
        if not game.rated:
            return None
        if player_color == "white" and game.white_rating_after is not None:
            return game.white_rating_after - game.white_rating_before
        if player_color == "black" and game.black_rating_after is not None:
            return game.black_rating_after - game.black_rating_before
        return None

    @staticmethod
    def _category_ratings_for_user(user: UserModel) -> dict[RatingSpeed, int]:
        return {
            RatingSpeed.BULLET: user.bullet_rating,
            RatingSpeed.BLITZ: user.blitz_rating,
            RatingSpeed.RAPID: user.rapid_rating,
            RatingSpeed.CLASSICAL: user.classical_rating,
        }

    @staticmethod
    def _category_ratings_response(ratings: dict[RatingSpeed, int]) -> dict[str, int]:
        return {speed.value: ratings[speed] for speed in DISPLAY_RATING_SPEEDS}

    @staticmethod
    def _rating_column_for_speed(speed: RatingSpeed | None):
        if speed is RatingSpeed.BULLET:
            return UserModel.bullet_rating
        if speed is RatingSpeed.BLITZ:
            return UserModel.blitz_rating
        if speed is RatingSpeed.RAPID:
            return UserModel.rapid_rating
        if speed is RatingSpeed.CLASSICAL:
            return UserModel.classical_rating
        return UserModel.rating

    @staticmethod
    def _ratings_by_speed(
        user_id: UUID,
        base_ratings: dict[RatingSpeed, int],
        completed_games: list[GameModel],
    ) -> dict[str, int]:
        ratings = dict(base_ratings)
        filled_speeds: set[RatingSpeed] = set()
        for game in sorted(completed_games, key=lambda g: g.ended_at or g.started_at, reverse=True):
            if not game.rated:
                continue
            speed = SqlAlchemyProfileRepository._rating_speed_for_game(game)
            if speed in filled_speeds:
                continue
            if game.white_id == user_id:
                ratings[speed] = game.white_rating_after or game.white_rating_before or base_ratings[speed]
                filled_speeds.add(speed)
            elif game.black_id == user_id:
                ratings[speed] = game.black_rating_after or game.black_rating_before or base_ratings[speed]
                filled_speeds.add(speed)
        return SqlAlchemyProfileRepository._category_ratings_response(ratings)

    @staticmethod
    def _rating_speed_for_game(game: GameModel) -> RatingSpeed:
        initial_time_ms = getattr(game, "initial_time_ms", None)
        increment_ms = getattr(game, "increment_ms", None)
        if initial_time_ms is not None and increment_ms is not None and initial_time_ms > 0 and increment_ms >= 0:
            return rating_speed_for_clock(initial_time_ms, increment_ms)
        return rating_speed_for_time_control_name(getattr(game, "time_control_name", ""))

    @staticmethod
    def _unknown_player(user_id: UUID) -> ProfilePlayer:
        return ProfilePlayer(
            id=str(user_id),
            username=UNKNOWN_PLAYER_USERNAME,
            rating=UNKNOWN_PLAYER_RATING,
        )

    @staticmethod
    def _avatar_url(path: str | None) -> str | None:
        if not path:
            return None
        if path.startswith(("http://", "https://", "/media/")):
            return path
        return f"/media/avatars/{path.lstrip('/')}"
