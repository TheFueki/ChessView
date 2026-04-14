"""Pure rating calculation helpers."""

from domains.ratings.domain.entities import RatingChange, RatingUpdate

K_FACTOR = 32


def expected_score(player_rating: int, opponent_rating: int) -> float:
    return 1 / (1 + 10 ** ((opponent_rating - player_rating) / 400))


def score_from_result(result: str | None) -> tuple[float, float] | None:
    if result == "1-0":
        return 1.0, 0.0
    if result == "0-1":
        return 0.0, 1.0
    if result == "1/2-1/2":
        return 0.5, 0.5
    return None


def calculate_rating_update(
    *,
    rated: bool,
    status: str,
    result: str | None,
    white_before: int,
    black_before: int,
) -> RatingUpdate | None:
    if not rated or result is None or status == "aborted":
        return None

    scores = score_from_result(result)
    if scores is None:
        return None

    white_score, black_score = scores
    white_after = round(white_before + K_FACTOR * (white_score - expected_score(white_before, black_before)))
    black_after = round(black_before + K_FACTOR * (black_score - expected_score(black_before, white_before)))
    return RatingUpdate(
        white=RatingChange(before=white_before, after=white_after),
        black=RatingChange(before=black_before, after=black_after),
    )
