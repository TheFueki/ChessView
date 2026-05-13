"""Tournament presentation serializers."""

from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from uuid import UUID

from domains.tournaments.presentation.schemas import (
    TournamentDetailResponse,
    TournamentPairingResponse,
    TournamentPlayerResponse,
    TournamentRoundResponse,
    TournamentStandingResponse,
    TournamentSummaryResponse,
)

UNKNOWN_USERNAME = "?"
UNKNOWN_RATING = 1200


@dataclass(frozen=True, slots=True)
class TournamentPlayerDirectory:
    """Resolved tournament players with graceful fallbacks."""

    players: Mapping[UUID, TournamentPlayerResponse]

    def get(self, user_id: UUID, fallback_rating: int = UNKNOWN_RATING) -> TournamentPlayerResponse:
        return self.players.get(
            user_id,
            TournamentPlayerResponse(
                id=str(user_id),
                username=UNKNOWN_USERNAME,
                rating=fallback_rating,
            ),
        )


def player_directory_from_users(users: Mapping[UUID, object]) -> TournamentPlayerDirectory:
    return TournamentPlayerDirectory(
        players={
            user_id: TournamentPlayerResponse(
                id=str(user_id),
                username=user.username,
                rating=user.rating,
            )
            for user_id, user in users.items()
        }
    )


def to_tournament_summary_response(
    tournament,
    owner: TournamentPlayerResponse,
    *,
    player_count: int,
    viewer_is_member: bool,
    viewer_is_owner: bool,
) -> TournamentSummaryResponse:
    return TournamentSummaryResponse(
        id=str(tournament.id),
        name=tournament.name,
        time_control_name=tournament.time_control_name,
        tournament_type=tournament.tournament_type,
        entry_fee_cents=tournament.entry_fee_cents,
        status=tournament.status,
        current_round=tournament.current_round,
        total_rounds=tournament.total_rounds,
        player_count=player_count,
        owner=owner,
        viewer_is_member=viewer_is_member,
        viewer_is_owner=viewer_is_owner,
        created_at=tournament.created_at,
        started_at=tournament.started_at,
        finished_at=tournament.finished_at,
    )


def count_games_played(pairings: list) -> dict[UUID, int]:
    games_played: defaultdict[UUID, int] = defaultdict(int)
    for pairing in pairings:
        if pairing.black_id is None:
            games_played[pairing.white_id] += 1
            continue
        if pairing.result is not None:
            games_played[pairing.white_id] += 1
            games_played[pairing.black_id] += 1
    return dict(games_played)


def to_tournament_round_responses(
    rounds: list,
    pairings: list,
    players: TournamentPlayerDirectory,
    game_statuses: Mapping[UUID, str | None],
) -> list[TournamentRoundResponse]:
    rounds_payload: list[TournamentRoundResponse] = []
    for tournament_round in rounds:
        round_pairings = [pairing for pairing in pairings if pairing.round_number == tournament_round.round_number]
        rounds_payload.append(
            TournamentRoundResponse(
                round_number=tournament_round.round_number,
                pairings=[
                    TournamentPairingResponse(
                        id=pairing.id,
                        round_number=pairing.round_number,
                        white=players.get(pairing.white_id),
                        black=players.get(pairing.black_id) if pairing.black_id is not None else None,
                        game_id=str(pairing.game_id) if pairing.game_id else None,
                        game_status=game_statuses.get(pairing.game_id) if pairing.game_id is not None else None,
                        result=pairing.result,
                    )
                    for pairing in round_pairings
                ],
            )
        )
    return rounds_payload


def to_tournament_standing_responses(players: list, player_directory: TournamentPlayerDirectory, games_played: Mapping[UUID, int]) -> list[TournamentStandingResponse]:
    return [
        TournamentStandingResponse(
            rank=index + 1,
            player=player_directory.get(player.user_id, player.seed_rating),
            score=player.score,
            games_played=games_played.get(player.user_id, 0),
        )
        for index, player in enumerate(players)
    ]


def to_tournament_detail_response(
    summary: TournamentSummaryResponse,
    *,
    standings: list[TournamentStandingResponse],
    rounds: list[TournamentRoundResponse],
) -> TournamentDetailResponse:
    return TournamentDetailResponse(
        **summary.model_dump(),
        standings=standings,
        rounds=rounds,
    )
