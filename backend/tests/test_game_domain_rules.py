from datetime import datetime, timedelta, timezone
from uuid import uuid4

from domains.game.domain.clock import capture_clock_snapshot
from domains.game.domain.entities import Game
from domains.game.domain.outcomes import pause_for_disconnect
from domains.game.domain.value_objects import StartingRatings
from shared.time_controls import get_time_control_preset


def test_capture_clock_snapshot_reports_running_white_clock():
    now = datetime(2026, 4, 14, 12, 0, tzinfo=timezone.utc)
    game = Game(
        white_id=uuid4(),
        black_id=uuid4(),
        white_time_ms=300_000,
        black_time_ms=300_000,
        last_clock_started_at=now - timedelta(seconds=3),
        started_at=now - timedelta(seconds=3),
    )

    snapshot = capture_clock_snapshot(game, now)

    assert snapshot.active_color == "white"
    assert snapshot.white_time_ms == 297_000
    assert snapshot.black_time_ms == 300_000
    assert snapshot.is_paused is False


def test_pause_for_disconnect_freezes_clock_and_marks_grace_deadline():
    user_id = uuid4()
    other_id = uuid4()
    now = datetime(2026, 4, 14, 12, 0, tzinfo=timezone.utc)
    game = Game(
        white_id=user_id,
        black_id=other_id,
        white_time_ms=300_000,
        black_time_ms=300_000,
        last_clock_started_at=now - timedelta(seconds=4),
        started_at=now - timedelta(seconds=4),
    )
    snapshot = capture_clock_snapshot(game, now)

    pause_for_disconnect(game, user_id, snapshot, now, 20)

    assert game.last_clock_started_at is None
    assert game.disconnected_player_id == user_id
    assert game.disconnect_grace_deadline_at == now + timedelta(seconds=20)
    assert game.white_time_ms == 296_000
    assert game.black_time_ms == 300_000


def test_new_game_uses_explicit_time_control_and_starting_ratings():
    white_id = uuid4()
    black_id = uuid4()
    now = datetime(2026, 4, 14, 12, 0, tzinfo=timezone.utc)
    time_control = get_time_control_preset("3+2")

    assert time_control is not None

    game = Game.new(
        white_id=white_id,
        black_id=black_id,
        time_control=time_control,
        starting_ratings=StartingRatings(white=1510, black=1490),
        now=now,
    )

    assert game.time_control_name == "3+2"
    assert game.initial_time_ms == 180_000
    assert game.increment_ms == 2_000
    assert game.white_time_ms == 180_000
    assert game.black_time_ms == 180_000
    assert game.white_rating_before == 1510
    assert game.black_rating_before == 1490
    assert game.last_clock_started_at == now
