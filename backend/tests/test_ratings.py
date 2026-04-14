from domains.ratings.domain.services import calculate_rating_update


def test_aborted_games_do_not_apply_elo():
    assert (
        calculate_rating_update(
            rated=True,
            status="aborted",
            result=None,
            white_before=1200,
            black_before=1200,
        )
        is None
    )


def test_timeout_games_still_apply_elo():
    update = calculate_rating_update(
        rated=True,
        status="timeout",
        result="1-0",
        white_before=1200,
        black_before=1200,
    )

    assert update is not None
    assert update.white.after > 1200
    assert update.black.after < 1200
