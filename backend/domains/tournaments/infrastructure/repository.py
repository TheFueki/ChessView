"""SQLAlchemy tournament repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.tournaments.domain.entities import (
    Tournament,
    TournamentPairing,
    TournamentPlayer,
    TournamentRound,
)
from domains.tournaments.domain.repository import AbstractTournamentRepository
from domains.tournaments.domain.value_objects import PairingResult, TournamentPlayerStatus, TournamentStatus, TournamentType
from domains.tournaments.infrastructure.models import (
    TournamentModel,
    TournamentPairingModel,
    TournamentPlayerModel,
    TournamentRoundModel,
)


class SqlAlchemyTournamentRepository(AbstractTournamentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_tournament(self, tournament: Tournament) -> Tournament:
        model = self._new_tournament_model(tournament)
        self._session.add(model)
        await self._persist(model)
        return self._to_tournament(model)

    async def get_tournament(self, tournament_id: UUID) -> Tournament | None:
        result = await self._session.execute(select(TournamentModel).where(TournamentModel.id == tournament_id))
        model = result.scalar_one_or_none()
        return self._to_tournament(model) if model else None

    async def list_tournaments(self) -> list[Tournament]:
        result = await self._session.execute(
            select(TournamentModel).order_by(TournamentModel.created_at.desc())
        )
        return [self._to_tournament(model) for model in result.scalars().all()]

    async def update_tournament(self, tournament: Tournament) -> Tournament:
        model = await self._get_tournament_model(tournament.id)
        if model is None:
            raise ValueError(f"Tournament {tournament.id} not found")
        self._apply_tournament_state(model, tournament)
        await self._persist(model)
        return self._to_tournament(model)

    async def add_player(self, player: TournamentPlayer) -> TournamentPlayer:
        model = self._new_player_model(player)
        self._session.add(model)
        await self._persist(model)
        return self._to_player(model)

    async def get_player(self, tournament_id: UUID, user_id: UUID) -> TournamentPlayer | None:
        result = await self._session.execute(
            select(TournamentPlayerModel).where(
                TournamentPlayerModel.tournament_id == tournament_id,
                TournamentPlayerModel.user_id == user_id,
            )
        )
        model = result.scalar_one_or_none()
        return self._to_player(model) if model else None

    async def list_players(self, tournament_id: UUID) -> list[TournamentPlayer]:
        result = await self._session.execute(
            select(TournamentPlayerModel)
            .where(TournamentPlayerModel.tournament_id == tournament_id)
            .order_by(TournamentPlayerModel.joined_at)
        )
        return [self._to_player(model) for model in result.scalars().all()]

    async def remove_player(self, tournament_id: UUID, user_id: UUID) -> None:
        result = await self._session.execute(
            select(TournamentPlayerModel).where(
                TournamentPlayerModel.tournament_id == tournament_id,
                TournamentPlayerModel.user_id == user_id,
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            return
        await self._session.delete(model)
        await self._session.commit()

    async def update_players(self, players: list[TournamentPlayer]) -> list[TournamentPlayer]:
        if not players:
            return []

        player_map = {(player.tournament_id, player.user_id): player for player in players}
        tournament_ids = {player.tournament_id for player in players}
        result = await self._session.execute(
            select(TournamentPlayerModel).where(TournamentPlayerModel.tournament_id.in_(list(tournament_ids)))
        )
        models = [
            model
            for model in result.scalars().all()
            if (model.tournament_id, model.user_id) in player_map
        ]
        for model in models:
            self._apply_player_state(model, player_map[(model.tournament_id, model.user_id)])
        await self._session.commit()
        refreshed: list[TournamentPlayer] = []
        for model in models:
            await self._session.refresh(model)
            refreshed.append(self._to_player(model))
        return refreshed

    async def create_round(self, tournament_round: TournamentRound) -> TournamentRound:
        model = self._new_round_model(tournament_round)
        self._session.add(model)
        await self._persist(model)
        return self._to_round(model)

    async def list_rounds(self, tournament_id: UUID) -> list[TournamentRound]:
        result = await self._session.execute(
            select(TournamentRoundModel)
            .where(TournamentRoundModel.tournament_id == tournament_id)
            .order_by(TournamentRoundModel.round_number)
        )
        return [self._to_round(model) for model in result.scalars().all()]

    async def add_pairing(self, pairing: TournamentPairing) -> TournamentPairing:
        model = self._new_pairing_model(pairing)
        self._session.add(model)
        await self._persist(model)
        return self._to_pairing(model)

    async def list_pairings(
        self,
        tournament_id: UUID,
        round_number: int | None = None,
    ) -> list[TournamentPairing]:
        stmt = (
            select(TournamentPairingModel)
            .where(TournamentPairingModel.tournament_id == tournament_id)
            .order_by(TournamentPairingModel.round_number, TournamentPairingModel.id)
        )
        if round_number is not None:
            stmt = stmt.where(TournamentPairingModel.round_number == round_number)
        result = await self._session.execute(stmt)
        return [self._to_pairing(model) for model in result.scalars().all()]

    async def get_pairing_by_game_id(self, game_id: UUID) -> TournamentPairing | None:
        result = await self._session.execute(
            select(TournamentPairingModel).where(TournamentPairingModel.game_id == game_id)
        )
        model = result.scalar_one_or_none()
        return self._to_pairing(model) if model else None

    async def update_pairing(self, pairing: TournamentPairing) -> TournamentPairing:
        result = await self._session.execute(select(TournamentPairingModel).where(TournamentPairingModel.id == pairing.id))
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Pairing {pairing.id} not found")
        self._apply_pairing_state(model, pairing)
        await self._persist(model)
        return self._to_pairing(model)

    @staticmethod
    def _new_tournament_model(tournament: Tournament) -> TournamentModel:
        model = TournamentModel(
            id=tournament.id,
            owner_id=tournament.owner_id,
        )
        SqlAlchemyTournamentRepository._apply_tournament_state(model, tournament)
        return model

    @staticmethod
    def _apply_tournament_state(model: TournamentModel, tournament: Tournament) -> None:
        model.name = tournament.name
        model.time_control_name = tournament.time_control_name
        model.initial_time_ms = tournament.initial_time_ms
        model.increment_ms = tournament.increment_ms
        model.status = tournament.status
        model.tournament_type = tournament.tournament_type
        model.entry_fee_cents = tournament.entry_fee_cents
        model.current_round = tournament.current_round
        model.total_rounds = tournament.total_rounds
        model.created_at = tournament.created_at
        model.started_at = tournament.started_at
        model.finished_at = tournament.finished_at

    @staticmethod
    def _new_player_model(player: TournamentPlayer) -> TournamentPlayerModel:
        model = TournamentPlayerModel(
            tournament_id=player.tournament_id,
            user_id=player.user_id,
        )
        SqlAlchemyTournamentRepository._apply_player_state(model, player)
        return model

    @staticmethod
    def _apply_player_state(model: TournamentPlayerModel, player: TournamentPlayer) -> None:
        model.seed_rating = player.seed_rating
        model.score = player.score
        model.status = player.status
        model.joined_at = player.joined_at
        model.withdrawn_at = player.withdrawn_at

    @staticmethod
    def _new_round_model(tournament_round: TournamentRound) -> TournamentRoundModel:
        model = TournamentRoundModel(tournament_id=tournament_round.tournament_id)
        model.round_number = tournament_round.round_number
        return model

    @staticmethod
    def _new_pairing_model(pairing: TournamentPairing) -> TournamentPairingModel:
        model = TournamentPairingModel(tournament_id=pairing.tournament_id)
        SqlAlchemyTournamentRepository._apply_pairing_state(model, pairing)
        return model

    @staticmethod
    def _apply_pairing_state(model: TournamentPairingModel, pairing: TournamentPairing) -> None:
        model.round_number = pairing.round_number
        model.white_id = pairing.white_id
        model.black_id = pairing.black_id
        model.game_id = pairing.game_id
        model.result = pairing.result

    @staticmethod
    def _to_tournament(model: TournamentModel) -> Tournament:
        return Tournament(
            id=model.id,
            owner_id=model.owner_id,
            name=model.name,
            time_control_name=model.time_control_name,
            initial_time_ms=model.initial_time_ms,
            increment_ms=model.increment_ms,
            status=TournamentStatus(model.status),
            tournament_type=TournamentType(model.tournament_type),
            entry_fee_cents=model.entry_fee_cents,
            current_round=model.current_round,
            total_rounds=model.total_rounds,
            created_at=model.created_at,
            started_at=model.started_at,
            finished_at=model.finished_at,
        )

    @staticmethod
    def _to_player(model: TournamentPlayerModel) -> TournamentPlayer:
        return TournamentPlayer(
            tournament_id=model.tournament_id,
            user_id=model.user_id,
            seed_rating=model.seed_rating,
            score=model.score,
            status=TournamentPlayerStatus(model.status),
            joined_at=model.joined_at,
            withdrawn_at=model.withdrawn_at,
        )

    @staticmethod
    def _to_round(model: TournamentRoundModel) -> TournamentRound:
        return TournamentRound(
            id=model.id,
            tournament_id=model.tournament_id,
            round_number=model.round_number,
            created_at=model.created_at,
        )

    @staticmethod
    def _to_pairing(model: TournamentPairingModel) -> TournamentPairing:
        return TournamentPairing(
            id=model.id,
            tournament_id=model.tournament_id,
            round_number=model.round_number,
            white_id=model.white_id,
            black_id=model.black_id,
            game_id=model.game_id,
            result=PairingResult(model.result) if model.result is not None else None,
            created_at=model.created_at,
        )

    async def _get_tournament_model(self, tournament_id: UUID) -> TournamentModel | None:
        result = await self._session.execute(select(TournamentModel).where(TournamentModel.id == tournament_id))
        return result.scalar_one_or_none()

    async def _persist(
        self,
        model: TournamentModel | TournamentPlayerModel | TournamentRoundModel | TournamentPairingModel,
    ) -> None:
        await self._session.commit()
        await self._session.refresh(model)
