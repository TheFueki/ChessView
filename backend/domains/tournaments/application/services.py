"""Tournament application service."""

from collections.abc import Mapping
from datetime import datetime, timezone
import re
import secrets
from uuid import UUID

from domains.game.application.commands import CreateGameCommand
from domains.game.application.services import GameService
from domains.game.domain.repository import AbstractGameRepository
from domains.game.domain.value_objects import GameStatus, StartingRatings
from domains.identity.domain.entities import User
from domains.identity.domain.exceptions import UserNotFound
from domains.identity.domain.repository import AbstractUserRepository
from domains.tournaments.domain.entities import (
    Tournament,
    TournamentPairing,
    TournamentPlayer,
    TournamentRound,
)
from domains.tournaments.domain.exceptions import (
    InvalidTournamentConfiguration,
    TournamentAlreadyJoined,
    TournamentForbidden,
    TournamentNotFound,
    TournamentOwnerCannotLeave,
    TournamentPlayerNotFound,
    TournamentRegistrationClosed,
    TournamentRoundNotReady,
    TournamentStartRequirementsNotMet,
)
from domains.tournaments.domain.repository import AbstractTournamentRepository
from domains.tournaments.domain.services import (
    PairingAssignment,
    generate_swiss_pairings,
    score_for_result,
    sort_players_for_standings,
    swiss_round_count,
)
from domains.tournaments.domain.value_objects import PairingResult, TournamentStatus
from domains.tournaments.domain.value_objects import TournamentPlayerStatus, TournamentType
from shared.time_controls import TimeControl, get_time_control_preset, make_time_control


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TournamentService:
    def __init__(
        self,
        tournament_repo: AbstractTournamentRepository,
        user_repo: AbstractUserRepository,
        game_repo: AbstractGameRepository,
        game_service: GameService,
    ) -> None:
        self._tournaments = tournament_repo
        self._users = user_repo
        self._games = game_repo
        self._game_service = game_service

    async def list_tournaments(self) -> list[Tournament]:
        return await self._tournaments.list_tournaments()

    async def get_tournament_detail(
        self,
        tournament_id: UUID,
    ) -> tuple[Tournament, list[TournamentPlayer], list[TournamentRound], list[TournamentPairing]]:
        tournament = await self._require_tournament(tournament_id)
        players = await self._tournaments.list_players(tournament_id)
        rounds = await self._tournaments.list_rounds(tournament_id)
        pairings = await self._tournaments.list_pairings(tournament_id)
        return tournament, players, rounds, pairings

    async def create_tournament(
        self,
        owner_id: UUID,
        name: str,
        time_control_name: str,
        tournament_type: str = "swiss",
        entry_fee_cents: int = 0,
        total_rounds: int | None = None,
        *,
        initial_time_ms: int | None = None,
        increment_ms: int | None = None,
    ) -> Tournament:
        normalized_name = name.strip()
        if not normalized_name:
            raise InvalidTournamentConfiguration()

        time_control = self._time_control_for_create(time_control_name, initial_time_ms, increment_ms)
        if time_control is None:
            raise InvalidTournamentConfiguration()

        owner = await self._users.get_by_id(owner_id)
        if owner is None:
            raise UserNotFound()

        tournament = Tournament(
            owner_id=owner_id,
            name=normalized_name,
            time_control_name=time_control_name,
            initial_time_ms=time_control.initial_time_ms,
            increment_ms=time_control.increment_ms,
            tournament_type=TournamentType(tournament_type),
            entry_fee_cents=entry_fee_cents,
            total_rounds=total_rounds or 0,
        )
        tournament = await self._tournaments.create_tournament(tournament)
        await self._tournaments.add_player(
            TournamentPlayer(
                tournament_id=tournament.id,
                user_id=owner_id,
                seed_rating=owner.rating,
            )
        )
        return tournament

    async def update_tournament(
        self,
        tournament_id: UUID,
        user_id: UUID,
        *,
        name: str | None = None,
        entry_fee_cents: int | None = None,
        total_rounds: int | None = None,
    ) -> Tournament:
        tournament = await self._require_tournament(tournament_id)
        self._ensure_owner(tournament, user_id)
        if name is not None:
            tournament.name = name.strip()
        if entry_fee_cents is not None:
            tournament.entry_fee_cents = entry_fee_cents
        if total_rounds is not None:
            tournament.total_rounds = total_rounds
        return await self._tournaments.update_tournament(tournament)

    async def set_status(self, tournament_id: UUID, user_id: UUID, status_value: TournamentStatus) -> Tournament:
        tournament = await self._require_tournament(tournament_id)
        self._ensure_owner(tournament, user_id)
        tournament.status = status_value
        if status_value in {TournamentStatus.ACTIVE, TournamentStatus.RUNNING} and tournament.started_at is None:
            tournament.started_at = utc_now()
        if status_value == TournamentStatus.FINISHED:
            tournament.finished_at = utc_now()
        return await self._tournaments.update_tournament(tournament)

    async def withdraw_player(self, tournament_id: UUID, actor_user_id: UUID, player_user_id: UUID) -> Tournament:
        tournament = await self._require_tournament(tournament_id)
        if actor_user_id != player_user_id and tournament.owner_id != actor_user_id:
            raise TournamentForbidden()
        player = await self._tournaments.get_player(tournament_id, player_user_id)
        if player is None:
            raise TournamentPlayerNotFound()
        player.status = TournamentPlayerStatus.WITHDRAWN
        player.withdrawn_at = utc_now()
        await self._tournaments.update_players([player])
        return tournament

    async def join_tournament(self, tournament_id: UUID, user_id: UUID) -> Tournament:
        tournament = await self._require_tournament(tournament_id)
        self._ensure_registration_open(tournament)
        existing = await self._tournaments.get_player(tournament_id, user_id)
        if existing is not None:
            raise TournamentAlreadyJoined()

        user = await self._users.get_by_id(user_id)
        if user is None:
            raise UserNotFound()

        await self._tournaments.add_player(
            TournamentPlayer(
                tournament_id=tournament_id,
                user_id=user_id,
                seed_rating=user.rating,
            )
        )
        return tournament

    async def add_otb_player(
        self,
        tournament_id: UUID,
        owner_id: UUID,
        *,
        display_name: str,
        seed_rating: int = 1200,
    ) -> TournamentPlayer:
        tournament = await self._require_tournament(tournament_id)
        self._ensure_owner(tournament, owner_id)
        self._ensure_registration_open(tournament)

        normalized_name = display_name.strip()
        if not normalized_name:
            raise InvalidTournamentConfiguration()

        username = await self._available_otb_username(normalized_name)
        user = await self._users.create(
            User(
                username=username,
                email=f"{username.lower()}-{secrets.token_hex(4)}@otb.chessview.local",
                password_hash=f"otb:{secrets.token_urlsafe(24)}",
                rating=max(100, min(3000, seed_rating)),
                bio="OTB tournament entrant managed by the tournament owner.",
            )
        )
        player = TournamentPlayer(
            tournament_id=tournament_id,
            user_id=user.id,
            seed_rating=user.rating,
        )
        return await self._tournaments.add_player(player)

    async def leave_tournament(self, tournament_id: UUID, user_id: UUID) -> Tournament:
        tournament = await self._require_tournament(tournament_id)
        self._ensure_registration_open(tournament)
        if tournament.owner_id == user_id:
            raise TournamentOwnerCannotLeave()

        player = await self._tournaments.get_player(tournament_id, user_id)
        if player is None:
            raise TournamentPlayerNotFound()

        await self._tournaments.remove_player(tournament_id, user_id)
        return tournament

    async def start_tournament(self, tournament_id: UUID, user_id: UUID) -> Tournament:
        tournament = await self._require_tournament(tournament_id)
        self._ensure_owner(tournament, user_id)
        self._ensure_ready_to_start(tournament)

        players = await self._tournaments.list_players(tournament_id)
        active_players = [player for player in players if player.status == TournamentPlayerStatus.ACTIVE]
        total_rounds = tournament.total_rounds or swiss_round_count(len(active_players))
        if total_rounds == 0:
            raise TournamentStartRequirementsNotMet()

        tournament.status = TournamentStatus.ACTIVE
        tournament.current_round = 1
        tournament.total_rounds = total_rounds
        tournament.started_at = utc_now()
        tournament = await self._tournaments.update_tournament(tournament)
        await self._tournaments.create_round(TournamentRound(tournament_id=tournament_id, round_number=1))
        await self._create_round_pairings(tournament, active_players, 1)
        return tournament

    async def advance_tournament(self, tournament_id: UUID, user_id: UUID) -> Tournament:
        tournament = await self._require_tournament(tournament_id)
        self._ensure_owner(tournament, user_id)
        return await self._advance_if_round_complete(tournament, require_ready=True)

    async def sync_game_result(self, game_id: UUID) -> Tournament | None:
        pairing = await self._tournaments.get_pairing_by_game_id(game_id)
        if pairing is None or pairing.result is not None:
            return None

        tournament = await self._require_tournament(pairing.tournament_id)
        game = await self._games.get_by_id(game_id)
        if game is None or game.status == GameStatus.ACTIVE:
            return None

        pairing_result = self._resolve_pairing_result(game)
        if pairing_result is None:
            return None

        await self._apply_pairing_result(pairing, pairing_result)
        return await self._advance_if_round_complete(tournament)

    async def _advance_if_round_complete(
        self,
        tournament: Tournament,
        *,
        require_ready: bool = False,
    ) -> Tournament:
        if tournament.status != TournamentStatus.ACTIVE:
            if require_ready:
                raise TournamentRoundNotReady()
            return tournament

        round_pairings = await self._tournaments.list_pairings(tournament.id, tournament.current_round)
        if any(pairing.result is None for pairing in round_pairings):
            if require_ready:
                raise TournamentRoundNotReady()
            return tournament

        if tournament.current_round >= tournament.total_rounds:
            tournament.status = TournamentStatus.FINISHED
            tournament.finished_at = utc_now()
            return await self._tournaments.update_tournament(tournament)

        players = [
            player
            for player in await self._tournaments.list_players(tournament.id)
            if player.status == TournamentPlayerStatus.ACTIVE
        ]
        prior_pairings = await self._tournaments.list_pairings(tournament.id)
        next_round = tournament.current_round + 1
        tournament.current_round = next_round
        tournament = await self._tournaments.update_tournament(tournament)
        await self._tournaments.create_round(TournamentRound(tournament_id=tournament.id, round_number=next_round))
        await self._create_round_pairings(tournament, players, next_round, prior_pairings=prior_pairings)
        return tournament

    async def _create_round_pairings(
        self,
        tournament: Tournament,
        players: list[TournamentPlayer],
        round_number: int,
        *,
        prior_pairings: list[TournamentPairing] | None = None,
    ) -> None:
        existing_pairings = (
            prior_pairings
            if prior_pairings is not None
            else await self._tournaments.list_pairings(tournament.id)
        )
        assignments = generate_swiss_pairings(players, existing_pairings, round_number)
        players_by_id = {player.user_id: player for player in players}
        users = await self._users.get_by_ids(
            {assignment.white_id for assignment in assignments}
            | {assignment.black_id for assignment in assignments if assignment.black_id is not None}
        )
        changed_players: dict[UUID, TournamentPlayer] = {}

        for assignment in assignments:
            if assignment.black_id is None:
                self._apply_bye_assignment(players_by_id[assignment.white_id], changed_players)
                await self._tournaments.add_pairing(
                    TournamentPairing(
                        tournament_id=tournament.id,
                        round_number=round_number,
                        white_id=assignment.white_id,
                        black_id=None,
                        result=PairingResult.WHITE_WINS,
                    )
                )
                continue

            await self._tournaments.add_pairing(
                TournamentPairing(
                    tournament_id=tournament.id,
                    round_number=round_number,
                    white_id=assignment.white_id,
                    black_id=assignment.black_id,
                    game_id=(
                        await self._game_service.create_game(
                            self._build_game_command(
                                tournament=tournament,
                                assignment=assignment,
                                users=users,
                                players_by_id=players_by_id,
                            )
                        )
                    ).id,
                )
            )

        await self._tournaments.update_players(list(changed_players.values()))

    async def _apply_pairing_result(self, pairing: TournamentPairing, result: PairingResult) -> None:
        pairing.result = result
        await self._tournaments.update_pairing(pairing)

        scores = score_for_result(result)
        if scores is None:
            return

        white_score, black_score = scores
        white_player = await self._tournaments.get_player(pairing.tournament_id, pairing.white_id)
        if white_player is None:
            raise TournamentPlayerNotFound()

        players_to_update = [white_player]
        white_player.score += white_score

        if pairing.black_id is not None:
            black_player = await self._tournaments.get_player(pairing.tournament_id, pairing.black_id)
            if black_player is None:
                raise TournamentPlayerNotFound()
            black_player.score += black_score
            players_to_update.append(black_player)

        await self._tournaments.update_players(players_to_update)

    async def _require_tournament(self, tournament_id: UUID) -> Tournament:
        tournament = await self._tournaments.get_tournament(tournament_id)
        if tournament is None:
            raise TournamentNotFound()
        return tournament

    @staticmethod
    def _ensure_registration_open(tournament: Tournament) -> None:
        if tournament.status not in {TournamentStatus.REGISTRATION, TournamentStatus.REGISTRATION_OPEN}:
            raise TournamentRegistrationClosed()

    @staticmethod
    def _ensure_ready_to_start(tournament: Tournament) -> None:
        if tournament.status not in {
            TournamentStatus.REGISTRATION,
            TournamentStatus.REGISTRATION_OPEN,
            TournamentStatus.REGISTRATION_CLOSED,
        }:
            raise TournamentRegistrationClosed()

    @staticmethod
    def _ensure_owner(tournament: Tournament, user_id: UUID) -> None:
        if tournament.owner_id != user_id:
            raise TournamentForbidden()

    async def _available_otb_username(self, display_name: str) -> str:
        compact = re.sub(r"[^A-Za-z0-9]", "", display_name)
        base = (compact or "OTBPlayer")[:24]
        candidate = base
        suffix = 1
        while await self._users.get_by_username(candidate):
            suffix += 1
            suffix_text = str(suffix)
            candidate = f"{base[: 32 - len(suffix_text)]}{suffix_text}"
        return candidate

    @staticmethod
    def standings(players: list[TournamentPlayer]) -> list[TournamentPlayer]:
        return sort_players_for_standings(players)

    @staticmethod
    def _build_game_command(
        *,
        tournament: Tournament,
        assignment: PairingAssignment,
        users: Mapping[UUID, User],
        players_by_id: dict[UUID, TournamentPlayer],
    ) -> CreateGameCommand:
        white_rating = users.get(assignment.white_id)
        black_rating = users.get(assignment.black_id)
        return CreateGameCommand(
            white_id=assignment.white_id,
            black_id=assignment.black_id,
            time_control=TournamentService._resolve_time_control(tournament),
            starting_ratings=StartingRatings(
                white=white_rating.rating if white_rating is not None else players_by_id[assignment.white_id].seed_rating,
                black=black_rating.rating if black_rating is not None else players_by_id[assignment.black_id].seed_rating,
            ),
            rated=True,
        )

    @staticmethod
    def _apply_bye_assignment(player: TournamentPlayer, changed_players: dict[UUID, TournamentPlayer]) -> None:
        player.score += 1.0
        changed_players[player.user_id] = player

    @staticmethod
    def _resolve_pairing_result(game) -> PairingResult | None:
        if game.result is not None:
            return PairingResult(game.result)
        if game.status == GameStatus.ABORTED:
            return PairingResult.DRAW
        return None

    @staticmethod
    def _resolve_time_control(tournament: Tournament) -> TimeControl:
        time_control = get_time_control_preset(tournament.time_control_name)
        if time_control is not None:
            return time_control
        try:
            return make_time_control(tournament.time_control_name, tournament.initial_time_ms, tournament.increment_ms)
        except ValueError as exc:
            raise InvalidTournamentConfiguration() from exc

    @staticmethod
    def _time_control_for_create(
        time_control_name: str,
        initial_time_ms: int | None,
        increment_ms: int | None,
    ) -> TimeControl | None:
        preset = get_time_control_preset(time_control_name)
        if preset is not None and initial_time_ms is None and increment_ms is None:
            return preset
        if initial_time_ms is None or increment_ms is None:
            return preset
        try:
            return make_time_control(time_control_name, initial_time_ms, increment_ms)
        except ValueError:
            return None
