"""Pure Swiss tournament helpers."""

import math
from dataclasses import dataclass
from uuid import UUID

from domains.tournaments.domain.entities import TournamentPairing, TournamentPlayer
from domains.tournaments.domain.value_objects import PairingResult


@dataclass(frozen=True)
class PairingAssignment:
    white_id: UUID
    black_id: UUID | None
    reason: str = "paired"


@dataclass(frozen=True)
class SwissPairingPlan:
    pairings: list[PairingAssignment]
    warnings: list[str]


def swiss_round_count(player_count: int) -> int:
    if player_count < 2:
        return 0
    return max(1, math.ceil(math.log2(player_count)))


def score_for_result(result: str | None) -> tuple[float, float] | None:
    if result == PairingResult.WHITE_WINS:
        return 1.0, 0.0
    if result == PairingResult.BLACK_WINS:
        return 0.0, 1.0
    if result == PairingResult.DRAW:
        return 0.5, 0.5
    return None


def sort_players_for_standings(players: list[TournamentPlayer]) -> list[TournamentPlayer]:
    return sorted(
        players,
        key=lambda player: (-player.score, -player.seed_rating, player.joined_at, str(player.user_id)),
    )


def generate_swiss_pairings(
    players: list[TournamentPlayer],
    prior_pairings: list[TournamentPairing],
    round_number: int,
) -> list[PairingAssignment]:
    ranked_players = sort_players_for_standings(players)
    rematches = {
        frozenset({pairing.white_id, pairing.black_id})
        for pairing in prior_pairings
        if pairing.black_id is not None
    }
    bye_recipients = {pairing.white_id for pairing in prior_pairings if pairing.black_id is None}
    color_balance = _color_balance(prior_pairings)

    working_players = list(ranked_players)
    assignments: list[PairingAssignment] = []

    if len(working_players) % 2 == 1:
        bye_player = _choose_bye_player(working_players, bye_recipients)
        working_players = [player for player in working_players if player.user_id != bye_player.user_id]
        assignments.append(PairingAssignment(white_id=bye_player.user_id, black_id=None))

    while working_players:
        player = working_players.pop(0)
        candidate_index = _choose_opponent_index(player, working_players, rematches)
        opponent = working_players.pop(candidate_index)
        white_id, black_id = _assign_colors(
            player.user_id,
            opponent.user_id,
            round_number,
            color_balance,
        )
        assignments.append(PairingAssignment(white_id=white_id, black_id=black_id))

    return assignments


def plan_swiss_pairings(
    players: list[TournamentPlayer],
    prior_pairings: list[TournamentPairing],
    round_number: int,
) -> SwissPairingPlan:
    active_players = [player for player in players if getattr(player, "status", "active") == "active"]
    pairings = generate_swiss_pairings(active_players, prior_pairings, round_number)
    warnings: list[str] = []
    prior_matches = {
        frozenset({pairing.white_id, pairing.black_id})
        for pairing in prior_pairings
        if pairing.black_id is not None
    }
    for pairing in pairings:
        if pairing.black_id is not None and frozenset({pairing.white_id, pairing.black_id}) in prior_matches:
            warnings.append("rematch_unavoidable")
    if any(pairing.black_id is None for pairing in pairings):
        warnings.append("bye_assigned")
    return SwissPairingPlan(pairings=pairings, warnings=warnings)


def buchholz_scores(players: list[TournamentPlayer], pairings: list[TournamentPairing]) -> dict[UUID, float]:
    scores = {player.user_id: player.score for player in players}
    totals = {player.user_id: 0.0 for player in players}
    for pairing in pairings:
        if pairing.black_id is None:
            continue
        totals[pairing.white_id] = totals.get(pairing.white_id, 0.0) + scores.get(pairing.black_id, 0.0)
        totals[pairing.black_id] = totals.get(pairing.black_id, 0.0) + scores.get(pairing.white_id, 0.0)
    return totals


def direct_encounter_score(user_id: UUID, opponent_id: UUID, pairings: list[TournamentPairing]) -> float:
    score = 0.0
    for pairing in pairings:
        if pairing.black_id is None or {pairing.white_id, pairing.black_id} != {user_id, opponent_id}:
            continue
        result = score_for_result(pairing.result)
        if result is None:
            continue
        white_score, black_score = result
        score += white_score if pairing.white_id == user_id else black_score
    return score


def performance_scores(players: list[TournamentPlayer]) -> dict[UUID, float]:
    return {
        player.user_id: round(player.score / max(1, swiss_round_count(len(players))), 3)
        for player in players
    }


def _choose_bye_player(
    ranked_players: list[TournamentPlayer],
    bye_recipients: set[UUID],
) -> TournamentPlayer:
    for player in reversed(ranked_players):
        if player.user_id not in bye_recipients:
            return player
    return ranked_players[-1]


def _choose_opponent_index(
    player: TournamentPlayer,
    candidates: list[TournamentPlayer],
    rematches: set[frozenset[UUID]],
) -> int:
    preferred_index: int | None = None
    preferred_score_gap: float | None = None

    for index, candidate in enumerate(candidates):
        score_gap = abs(player.score - candidate.score)
        has_rematch = frozenset({player.user_id, candidate.user_id}) in rematches
        if has_rematch:
            continue
        if preferred_index is None or score_gap < (preferred_score_gap or float("inf")):
            preferred_index = index
            preferred_score_gap = score_gap

    return preferred_index if preferred_index is not None else 0


def _assign_colors(
    first_id: UUID,
    second_id: UUID,
    round_number: int,
    color_balance: dict[UUID, int],
) -> tuple[UUID, UUID]:
    first_balance = color_balance.get(first_id, 0)
    second_balance = color_balance.get(second_id, 0)

    if first_balance < second_balance:
        return first_id, second_id
    if second_balance < first_balance:
        return second_id, first_id
    if round_number % 2 == 1:
        return first_id, second_id
    return second_id, first_id


def _color_balance(prior_pairings: list[TournamentPairing]) -> dict[UUID, int]:
    balance: dict[UUID, int] = {}
    for pairing in prior_pairings:
        balance[pairing.white_id] = balance.get(pairing.white_id, 0) + 1
        if pairing.black_id is not None:
            balance[pairing.black_id] = balance.get(pairing.black_id, 0) - 1
    return balance
