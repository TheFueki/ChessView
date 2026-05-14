"""Scheduled match lifecycle service."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.game.application.commands import CreateGameCommand
from domains.game.application.services import GameService
from domains.game.domain.value_objects import StartingRatings
from domains.game.infrastructure.repository import SqlAlchemyGameRepository
from domains.identity.infrastructure.models import UserModel
from domains.scheduled_matches.infrastructure.models import ScheduledMatchModel
from domains.scheduled_matches.presentation.schemas import ScheduledMatchResponse
from domains.tournaments.infrastructure.models import TournamentModel, TournamentPairingModel
from shared.time_controls import TimeControl, get_time_control_preset, make_time_control


STARTABLE_MATCH_STATUSES = {"scheduled", "accepted", "rescheduled"}


def validate_scheduled_match_transition(match: ScheduledMatchModel, user_id: UUID, status_value: str) -> None:
    if status_value == "accepted":
        if match.invited_user_id != user_id or match.creator_user_id == user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only invited opponent can accept")
        if match.status != "pending_acceptance":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Match is not awaiting acceptance")
        return
    if status_value == "declined":
        if match.invited_user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only invited opponent can decline")
        if match.status != "pending_acceptance":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Match is not awaiting acceptance")
        return
    if status_value == "cancelled":
        if match.creator_user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only creator can cancel")
        if match.status in {"live", "completed"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Match cannot be cancelled")
        return
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported scheduled match transition")


def validate_scheduled_match_start(match: ScheduledMatchModel, user_id: UUID) -> None:
    if user_id not in {match.creator_user_id, match.invited_user_id, match.white_player_id, match.black_player_id}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if match.game_id is not None and match.status == "live":
        return
    if match.status not in STARTABLE_MATCH_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Match is not ready to start")
    if match.white_player_id is None or match.black_player_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Both players are required")


class ScheduledMatchService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_user(self, user_id: UUID) -> list[ScheduledMatchModel]:
        result = await self._session.execute(
            select(ScheduledMatchModel)
            .where(
                or_(
                    ScheduledMatchModel.creator_user_id == user_id,
                    ScheduledMatchModel.invited_user_id == user_id,
                    ScheduledMatchModel.white_player_id == user_id,
                    ScheduledMatchModel.black_player_id == user_id,
                )
            )
            .order_by(ScheduledMatchModel.starts_at)
        )
        return list(result.scalars().all())

    async def create_invitation(
        self,
        *,
        creator_user_id: UUID,
        invited_user_id: UUID | None,
        starts_at: datetime,
        expires_at: datetime | None,
        metadata: dict,
    ) -> ScheduledMatchModel:
        if invited_user_id is not None and invited_user_id == creator_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Self-invites are not supported")
        match = ScheduledMatchModel(
            creator_user_id=creator_user_id,
            invited_user_id=invited_user_id,
            white_player_id=creator_user_id,
            black_player_id=invited_user_id,
            starts_at=starts_at,
            expires_at=expires_at,
            status="scheduled" if invited_user_id is None else "pending_acceptance",
            metadata_json=metadata,
        )
        self._session.add(match)
        await self._session.commit()
        await self._session.refresh(match)
        return match

    async def transition(self, match_id: UUID, user_id: UUID, status_value: str) -> ScheduledMatchModel:
        match = await self._require_match(match_id)
        validate_scheduled_match_transition(match, user_id, status_value)
        match.status = status_value
        match.updated_at = datetime.now(timezone.utc)
        await self._session.commit()
        await self._session.refresh(match)
        return match

    async def reschedule(
        self,
        match_id: UUID,
        user_id: UUID,
        starts_at: datetime,
        expires_at: datetime | None,
    ) -> ScheduledMatchModel:
        match = await self._require_match(match_id)
        if user_id not in {match.creator_user_id, match.invited_user_id}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
        match.starts_at = starts_at
        match.expires_at = expires_at
        match.status = "rescheduled"
        match.updated_at = datetime.now(timezone.utc)
        await self._session.commit()
        await self._session.refresh(match)
        return match

    async def start(self, match_id: UUID, user_id: UUID) -> ScheduledMatchModel:
        match = await self._require_match(match_id)
        validate_scheduled_match_start(match, user_id)
        if match.game_id is not None:
            match.status = "live"
            match.updated_at = datetime.now(timezone.utc)
            await self._session.commit()
            await self._session.refresh(match)
            return match

        white = await self._session.get(UserModel, match.white_player_id)
        black = await self._session.get(UserModel, match.black_player_id)
        if white is None or black is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
        time_control: TimeControl | None = get_time_control_preset("5+0")
        if match.tournament_id is not None:
            tournament = await self._session.get(TournamentModel, match.tournament_id)
            if tournament is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
            time_control = self._resolve_match_time_control(tournament)
        if time_control is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Default time control missing")
        game = await GameService(SqlAlchemyGameRepository(self._session)).create_game(
            CreateGameCommand(
                white_id=match.white_player_id,
                black_id=match.black_player_id,
                time_control=time_control,
                starting_ratings=StartingRatings(white=white.rating, black=black.rating),
                rated=True,
            )
        )
        if match.pairing_id is not None:
            pairing = await self._session.get(TournamentPairingModel, match.pairing_id)
            if pairing is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament pairing not found")
            pairing.game_id = game.id
        match.game_id = game.id
        match.status = "live"
        match.updated_at = datetime.now(timezone.utc)
        await self._session.commit()
        await self._session.refresh(match)
        return match

    async def _require_match(self, match_id: UUID) -> ScheduledMatchModel:
        match = await self._session.get(ScheduledMatchModel, match_id)
        if match is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled match not found")
        return match

    @staticmethod
    def to_response(match: ScheduledMatchModel) -> ScheduledMatchResponse:
        return ScheduledMatchResponse(
            id=match.id,
            tournament_id=match.tournament_id,
            round_id=match.round_id,
            pairing_id=match.pairing_id,
            white_player_id=match.white_player_id,
            black_player_id=match.black_player_id,
            creator_user_id=match.creator_user_id,
            invited_user_id=match.invited_user_id,
            starts_at=match.starts_at,
            expires_at=match.expires_at,
            status=match.status,
            game_id=match.game_id,
            metadata=match.metadata_json,
            created_at=match.created_at,
            updated_at=match.updated_at,
        )

    @staticmethod
    def _resolve_match_time_control(tournament: TournamentModel | object) -> TimeControl:
        preset = get_time_control_preset(tournament.time_control_name)
        if preset is not None:
            return preset
        try:
            return make_time_control(tournament.time_control_name, tournament.initial_time_ms, tournament.increment_ms)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Tournament time control missing") from exc
