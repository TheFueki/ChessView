from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.dependencies import require_admin
from domains.game.domain.value_objects import GameResult
from domains.identity.face_verification.provider import LocalStubFaceVerificationProvider
from domains.identity.face_verification.service import is_game_participant
from domains.identity.infrastructure.models import UserModel
from domains.payments.service import (
    SUCCESS_SCENARIOS,
    TERMINAL_RELEASE_STATUSES,
    apply_refund_to_registration,
    occupies_tournament_slot,
)
from domains.profiles.application.head_to_head import HeadToHeadService
from domains.profiles.application.head_to_head import _Stats
from domains.scheduled_matches.service import validate_scheduled_match_start, validate_scheduled_match_transition
from domains.scheduled_matches.service import ScheduledMatchService
from domains.scheduled_matches.infrastructure.models import ScheduledMatchModel
from domains.tournaments.infrastructure.models import TournamentModel, TournamentPairingModel
from domains.tournaments.infrastructure.models import TournamentPlayerModel
from domains.tournaments.domain.entities import TournamentPairing, TournamentPlayer
from domains.tournaments.domain.services import (
    buchholz_scores,
    direct_encounter_score,
    performance_scores,
    plan_swiss_pairings,
)
from domains.tournaments.domain.value_objects import PairingResult, TournamentPlayerStatus


def _player(score: float = 0.0, *, status=TournamentPlayerStatus.ACTIVE) -> TournamentPlayer:
    return TournamentPlayer(
        tournament_id=uuid4(),
        user_id=uuid4(),
        seed_rating=1200,
        score=score,
        status=status,
    )


def test_swiss_plan_assigns_bye_and_excludes_withdrawn_players():
    players = [
        _player(2),
        _player(1),
        _player(1),
        _player(0),
        _player(0),
        _player(0, status=TournamentPlayerStatus.WITHDRAWN),
    ]

    plan = plan_swiss_pairings(players, [], round_number=1)

    paired_ids = {pairing.white_id for pairing in plan.pairings}
    paired_ids.update(pairing.black_id for pairing in plan.pairings if pairing.black_id is not None)
    assert players[-1].user_id not in paired_ids
    assert sum(1 for pairing in plan.pairings if pairing.black_id is None) == 1
    assert "bye_assigned" in plan.warnings


def test_swiss_plan_warns_when_rematch_is_unavoidable():
    players = [_player(1), _player(1)]
    prior = [
        TournamentPairing(
            tournament_id=players[0].tournament_id,
            round_number=1,
            white_id=players[0].user_id,
            black_id=players[1].user_id,
        )
    ]

    plan = plan_swiss_pairings(players, prior, round_number=2)

    assert len(plan.pairings) == 1
    assert "rematch_unavoidable" in plan.warnings


def test_tiebreak_helpers_compute_buchholz_direct_and_performance():
    first = _player(2)
    second = _player(1)
    third = _player(0)
    pairings = [
        TournamentPairing(
            tournament_id=first.tournament_id,
            round_number=1,
            white_id=first.user_id,
            black_id=second.user_id,
            result=PairingResult.WHITE_WINS,
        ),
        TournamentPairing(
            tournament_id=first.tournament_id,
            round_number=2,
            white_id=third.user_id,
            black_id=first.user_id,
            result=PairingResult.BLACK_WINS,
        ),
    ]

    buchholz = buchholz_scores([first, second, third], pairings)

    assert buchholz[first.user_id] == pytest.approx(1.0)
    assert direct_encounter_score(first.user_id, second.user_id, pairings) == pytest.approx(1.0)
    assert performance_scores([first, second, third])[first.user_id] > performance_scores([first, second, third])[third.user_id]


def test_face_verification_stub_statuses_are_explicit():
    provider = LocalStubFaceVerificationProvider()

    assert provider.verify(None).status == "verified"
    assert provider.verify("fail").status == "failed"
    assert provider.verify("uncertain").status == "uncertain"


def test_payment_emulator_status_mapping_covers_required_scenarios():
    assert SUCCESS_SCENARIOS == {
        "success": "succeeded",
        "pending": "pending",
        "failed": "failed",
        "cancelled": "cancelled",
        "expired": "expired",
        "refunded": "refunded",
        "disputed": "disputed",
    }
    assert TERMINAL_RELEASE_STATUSES == {"failed", "cancelled", "expired"}


def test_payment_slot_occupancy_tracks_pending_expiration_and_success():
    now = datetime(2026, 5, 13, 12, 0, tzinfo=timezone.utc)

    assert occupies_tournament_slot("created", None, now) is False
    assert occupies_tournament_slot("pending", now + timedelta(minutes=5), now) is True
    assert occupies_tournament_slot("pending", now - timedelta(seconds=1), now) is False
    assert occupies_tournament_slot("succeeded", None, now) is True
    assert occupies_tournament_slot("failed", now + timedelta(minutes=5), now) is False
    assert occupies_tournament_slot("cancelled", now + timedelta(minutes=5), now) is False
    assert occupies_tournament_slot("expired", now + timedelta(minutes=5), now) is False
    assert occupies_tournament_slot("refunded", now + timedelta(minutes=5), now) is False
    assert occupies_tournament_slot("disputed", None, now) is True


def test_refund_marks_existing_registration_withdrawn_without_deleting_it():
    now = datetime(2026, 5, 13, 12, 0, tzinfo=timezone.utc)
    player = SimpleNamespace(status="active", withdrawn_at=None)

    apply_refund_to_registration(player, now)

    assert player.status == "withdrawn"
    assert player.withdrawn_at == now


@pytest.mark.asyncio
async def test_duplicate_payment_success_does_not_add_duplicate_registration():
    tournament_id = uuid4()
    user_id = uuid4()
    existing_player = SimpleNamespace(status="active", withdrawn_at=None)
    payment = SimpleNamespace(tournament_id=tournament_id, user_id=user_id)

    class FakeSession:
        added: list[object]

        def __init__(self) -> None:
            self.added = []

        async def get(self, model, key):
            if model is TournamentPlayerModel and key == (tournament_id, user_id):
                return existing_player
            return None

        def add(self, item):
            self.added.append(item)

    from domains.payments.service import PaymentService

    session = FakeSession()
    await PaymentService(session)._confirm_registration(payment)

    assert session.added == []


def test_scheduled_match_lifecycle_rejects_self_accept_and_start_before_acceptance():
    creator_id = uuid4()
    match = SimpleNamespace(
        creator_user_id=creator_id,
        invited_user_id=creator_id,
        white_player_id=creator_id,
        black_player_id=creator_id,
        status="pending_acceptance",
        game_id=None,
    )

    with pytest.raises(HTTPException):
        validate_scheduled_match_transition(match, creator_id, "accepted")

    with pytest.raises(HTTPException):
        validate_scheduled_match_start(match, creator_id)


def test_scheduled_match_unrelated_user_cannot_cancel():
    creator_id = uuid4()
    invited_id = uuid4()
    match = SimpleNamespace(
        creator_user_id=creator_id,
        invited_user_id=invited_id,
        white_player_id=creator_id,
        black_player_id=invited_id,
        status="pending_acceptance",
        game_id=None,
    )

    with pytest.raises(HTTPException):
        validate_scheduled_match_transition(match, uuid4(), "cancelled")


def test_scheduled_match_start_is_limited_to_accepted_or_scheduled_states():
    creator_id = uuid4()
    invited_id = uuid4()
    match = SimpleNamespace(
        creator_user_id=creator_id,
        invited_user_id=invited_id,
        white_player_id=creator_id,
        black_player_id=invited_id,
        status="accepted",
        game_id=None,
    )

    validate_scheduled_match_start(match, creator_id)
    validate_scheduled_match_start(match, invited_id)

    match.status = "declined"
    with pytest.raises(HTTPException):
        validate_scheduled_match_start(match, invited_id)

    match.status = "cancelled"
    with pytest.raises(HTTPException):
        validate_scheduled_match_start(match, creator_id)

    match.status = "live"
    match.game_id = uuid4()
    validate_scheduled_match_start(match, creator_id)


@pytest.mark.asyncio
async def test_scheduled_tournament_match_start_creates_game_and_links_pairing():
    creator_id = uuid4()
    white_id = uuid4()
    black_id = uuid4()
    tournament_id = uuid4()
    match_id = uuid4()
    pairing_id = 42
    match = ScheduledMatchModel(
        id=match_id,
        tournament_id=tournament_id,
        pairing_id=pairing_id,
        white_player_id=white_id,
        black_player_id=black_id,
        creator_user_id=creator_id,
        invited_user_id=black_id,
        starts_at=datetime.now(timezone.utc),
        status="accepted",
        metadata_json={},
    )
    pairing = TournamentPairingModel(
        id=pairing_id,
        tournament_id=tournament_id,
        round_number=1,
        white_id=white_id,
        black_id=black_id,
    )
    tournament = TournamentModel(
        id=tournament_id,
        owner_id=creator_id,
        name="Scheduled Swiss",
        time_control_name="3+2",
        initial_time_ms=180_000,
        increment_ms=2_000,
        status="active",
        current_round=1,
        total_rounds=3,
    )
    white = SimpleNamespace(id=white_id, rating=1510)
    black = SimpleNamespace(id=black_id, rating=1490)

    class FakeSession:
        def __init__(self) -> None:
            self.added = []

        async def get(self, model, key):
            if model is ScheduledMatchModel and key == match_id:
                return match
            if model is UserModel and key == white_id:
                return white
            if model is UserModel and key == black_id:
                return black
            if model is TournamentModel and key == tournament_id:
                return tournament
            if model is TournamentPairingModel and key == pairing_id:
                return pairing
            return None

        def add(self, item):
            self.added.append(item)

        async def commit(self):
            return None

        async def refresh(self, _item):
            return None

    started = await ScheduledMatchService(FakeSession()).start(match_id, white_id)

    assert started.status == "live"
    assert started.game_id is not None
    assert pairing.game_id == started.game_id


def test_face_verification_game_participation_is_strict():
    white_id = uuid4()
    black_id = uuid4()
    game = SimpleNamespace(white_id=white_id, black_id=black_id)

    assert is_game_participant(game, white_id) is True
    assert is_game_participant(game, black_id) is True
    assert is_game_participant(game, uuid4()) is False


def test_head_to_head_perspective_results_cover_colors_and_draws():
    user_id = uuid4()
    opponent_id = uuid4()

    assert HeadToHeadService._perspective_result(
        user_id,
        SimpleNamespace(white_id=user_id, black_id=opponent_id, result=GameResult.WHITE_WINS),
    ) == "win"
    assert HeadToHeadService._perspective_result(
        user_id,
        SimpleNamespace(white_id=opponent_id, black_id=user_id, result=GameResult.BLACK_WINS),
    ) == "win"
    assert HeadToHeadService._perspective_result(
        user_id,
        SimpleNamespace(white_id=user_id, black_id=opponent_id, result=GameResult.BLACK_WINS),
    ) == "loss"
    assert HeadToHeadService._perspective_result(
        user_id,
        SimpleNamespace(white_id=opponent_id, black_id=user_id, result=GameResult.WHITE_WINS),
    ) == "loss"
    assert HeadToHeadService._perspective_result(
        user_id,
        SimpleNamespace(white_id=user_id, black_id=opponent_id, result=GameResult.DRAW),
    ) == "draw"


def test_head_to_head_average_move_count_uses_recorded_move_counts():
    stats = _Stats()

    HeadToHeadService._apply(stats, "win", 12)
    HeadToHeadService._apply(stats, "draw", 20)

    assert stats.games == 2
    assert stats.wins == 1
    assert stats.draws == 1
    assert stats.average_moves == 16.0


@pytest.mark.asyncio
async def test_require_admin_rejects_normal_and_banned_users():
    user_id = uuid4()

    class FakeSession:
        async def get(self, _model, _user_id):
            return SimpleNamespace(role="user", banned_at=None)

    with pytest.raises(HTTPException):
        await require_admin(str(user_id), FakeSession())

    class BannedAdminSession:
        async def get(self, _model, _user_id):
            return SimpleNamespace(role="admin", banned_at=datetime.now(timezone.utc))

    with pytest.raises(HTTPException):
        await require_admin(str(user_id), BannedAdminSession())


@pytest.mark.asyncio
async def test_require_admin_accepts_unbanned_admin():
    user_id = uuid4()

    class FakeSession:
        async def get(self, _model, _user_id):
            return SimpleNamespace(role="admin", banned_at=None)

    assert await require_admin(str(user_id), FakeSession()) == str(user_id)


def test_swiss_plan_avoids_duplicate_bye_when_possible():
    players = [_player(2), _player(1), _player(1)]
    prior = [
        TournamentPairing(
            tournament_id=players[0].tournament_id,
            round_number=1,
            white_id=players[2].user_id,
            black_id=None,
        )
    ]

    plan = plan_swiss_pairings(players, prior, round_number=2)
    bye = next(pairing for pairing in plan.pairings if pairing.black_id is None)

    assert bye.white_id != players[2].user_id
