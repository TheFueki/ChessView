"""Head-to-head profile statistics."""

from collections import defaultdict
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.game.domain.value_objects import GameResult, GameStatus
from domains.game.infrastructure.models import GameModel, MoveModel
from domains.identity.infrastructure.models import UserModel
from domains.profiles.infrastructure.repository import SqlAlchemyProfileRepository
from domains.profiles.presentation.schemas import (
    HeadToHeadResponse,
    HeadToHeadTournamentBreakdownResponse,
)
from domains.tournaments.infrastructure.models import TournamentModel, TournamentPairingModel


@dataclass
class _Stats:
    games: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    moves: int = 0

    @property
    def average_moves(self) -> float:
        return round(self.moves / self.games, 1) if self.games else 0.0


class HeadToHeadService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: UUID, opponent_id: UUID) -> HeadToHeadResponse:
        games = await self._load_games(user_id, opponent_id)
        move_counts = await self._move_counts([game.id for game in games])
        tournament_lookup = await self._tournament_lookup([game.id for game in games])

        total = _Stats()
        white = _Stats()
        black = _Stats()
        by_tournament: dict[UUID, tuple[str, _Stats]] = {}

        for game in games:
            move_count = move_counts.get(game.id, 0)
            result = self._perspective_result(user_id, game)
            self._apply(total, result, move_count)
            color_stats = white if game.white_id == user_id else black
            self._apply(color_stats, result, move_count)

            tournament = tournament_lookup.get(game.id)
            if tournament is not None:
                tournament_id, name = tournament
                if tournament_id not in by_tournament:
                    by_tournament[tournament_id] = (name, _Stats())
                self._apply(by_tournament[tournament_id][1], result, move_count)

        recent = await SqlAlchemyProfileRepository(self._session).get_profile_summary(user_id, recent_game_limit=20)
        recent_games = []
        if recent is not None:
            h2h_ids = {str(game.id) for game in games}
            recent_games = [game for game in recent.recent_games if game.id in h2h_ids][:10]

        return HeadToHeadResponse(
            user_id=str(user_id),
            opponent_id=str(opponent_id),
            total_games=total.games,
            wins=total.wins,
            draws=total.draws,
            losses=total.losses,
            white_games=white.games,
            white_wins=white.wins,
            white_draws=white.draws,
            white_losses=white.losses,
            black_games=black.games,
            black_wins=black.wins,
            black_draws=black.draws,
            black_losses=black.losses,
            average_moves=total.average_moves,
            tournament_breakdown=[
                HeadToHeadTournamentBreakdownResponse(
                    tournament_id=str(tournament_id),
                    tournament_name=name,
                    games=stats.games,
                    wins=stats.wins,
                    draws=stats.draws,
                    losses=stats.losses,
                    average_moves=stats.average_moves,
                )
                for tournament_id, (name, stats) in by_tournament.items()
            ],
            recent_games=recent_games,
        )

    async def _load_games(self, user_id: UUID, opponent_id: UUID) -> list[GameModel]:
        result = await self._session.execute(
            select(GameModel)
            .where(
                or_(
                    and_(GameModel.white_id == user_id, GameModel.black_id == opponent_id),
                    and_(GameModel.white_id == opponent_id, GameModel.black_id == user_id),
                ),
                GameModel.status.notin_([GameStatus.ACTIVE, GameStatus.ABORTED]),
            )
            .order_by(GameModel.started_at.desc())
        )
        return list(result.scalars().all())

    async def _move_counts(self, game_ids: list[UUID]) -> dict[UUID, int]:
        if not game_ids:
            return {}
        result = await self._session.execute(
            select(MoveModel.game_id, func.count(MoveModel.id))
            .where(MoveModel.game_id.in_(game_ids))
            .group_by(MoveModel.game_id)
        )
        return {game_id: count for game_id, count in result.all()}

    async def _tournament_lookup(self, game_ids: list[UUID]) -> dict[UUID, tuple[UUID, str]]:
        if not game_ids:
            return {}
        result = await self._session.execute(
            select(TournamentPairingModel.game_id, TournamentModel.id, TournamentModel.name)
            .join(TournamentModel, TournamentModel.id == TournamentPairingModel.tournament_id)
            .where(TournamentPairingModel.game_id.in_(game_ids))
        )
        return {game_id: (tournament_id, name) for game_id, tournament_id, name in result.all() if game_id is not None}

    @staticmethod
    def _perspective_result(user_id: UUID, game: GameModel) -> str:
        if game.result == GameResult.DRAW:
            return "draw"
        if game.result == GameResult.WHITE_WINS:
            return "win" if game.white_id == user_id else "loss"
        if game.result == GameResult.BLACK_WINS:
            return "win" if game.black_id == user_id else "loss"
        return "draw"

    @staticmethod
    def _apply(stats: _Stats, result: str, move_count: int) -> None:
        stats.games += 1
        stats.moves += move_count
        if result == "win":
            stats.wins += 1
        elif result == "loss":
            stats.losses += 1
        else:
            stats.draws += 1
