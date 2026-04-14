"""Tournament application service."""

from collections.abc import Mapping
from datetime import datetime, timezone
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
from shared.time_controls import TimeControl, get_time_control_preset


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

    async def create_tournament(self, owner_id: UUID, name: str, time_control_name: str) -> Tournament:
        normalized_name = name.strip()
        if not normalized_name:
            raise InvalidTournamentConfiguration()

        preset = get_time_control_preset(time_control_name)
        if preset is None:
            raise InvalidTournamentConfiguration()

        owner = await self._users.get_by_id(owner_id)
        if owner is None:
            raise UserNotFound()

        tournament = Tournament(
            owner_id=owner_id,
            name=normalized_name,
            time_control_name=time_control_name,
            initial_time_ms=preset.initial_time_ms,
            increment_ms=preset.increment_ms,
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
        self._ensure_registration_open(tournament)

        players = await self._tournaments.list_players(tournament_id)
        total_rounds = swiss_round_count(len(players))
        if total_rounds == 0:
            raise TournamentStartRequirementsNotMet()

        tournament.status = TournamentStatus.ACTIVE
        tournament.current_round = 1
        tournament.total_rounds = total_rounds
        tournament.started_at = utc_now()
        tournament = await self._tournaments.update_tournament(tournament)
        await self._tournaments.create_round(TournamentRound(tournament_id=tournament_id, round_number=1))
        await self._create_round_pairings(tournament, players, 1)
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

        players = await self._tournaments.list_players(tournament.id)
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

            game = await self._game_service.create_game(
                self._build_game_command(
                    tournament=tournament,
                    assignment=assignment,
                    users=users,
                    players_by_id=players_by_id,
                )
            )
            await self._tournaments.add_pairing(
                TournamentPairing(
                    tournament_id=tournament.id,
                    round_number=round_number,
                    white_id=assignment.white_id,
                    black_id=assignment.black_id,
                    game_id=game.id,
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
        if tournament.status != TournamentStatus.REGISTRATION:
            raise TournamentRegistrationClosed()

    @staticmethod
    def _ensure_owner(tournament: Tournament, user_id: UUID) -> None:
        if tournament.owner_id != user_id:
            raise TournamentForbidden()

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
        if time_control is None:
            raise InvalidTournamentConfiguration()
        return time_control
