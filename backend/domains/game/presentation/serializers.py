"""Read-model serializers for game presentation payloads."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from uuid import UUID

from domains.game.presentation.schemas import (
    ClockStateResponse,
    GameDetailResponse,
    GameListItem,
    MoveResponse,
    PlayerBrief,
    PlayerDetail,
    RatingSummaryResponse,
)

UNKNOWN_USERNAME = "?"
UNKNOWN_RATING = 1200


@dataclass(frozen=True, slots=True)
class PlayerDirectory:
    """Resolved player details with safe fallbacks for missing users."""

    players: Mapping[UUID, PlayerDetail]

    def detail(self, user_id: UUID) -> PlayerDetail:
        return self.players.get(
            user_id,
            PlayerDetail(
                id=str(user_id),
                username=UNKNOWN_USERNAME,
                rating=UNKNOWN_RATING,
                avatar_url=None,
            ),
        )

    def brief(self, user_id: UUID) -> PlayerBrief:
        detail = self.detail(user_id)
        return PlayerBrief(
            id=detail.id,
            username=detail.username,
            rating=detail.rating,
            avatar_url=detail.avatar_url,
        )


def to_game_list_item(game, current_user_id: UUID, players: PlayerDirectory, move_count: int) -> GameListItem:
    my_color = "white" if game.white_id == current_user_id else "black"
    opponent_id = game.black_id if my_color == "white" else game.white_id
    return GameListItem(
        id=str(game.id),
        white=players.brief(game.white_id),
        black=players.brief(game.black_id),
        opponent=players.brief(opponent_id),
        my_color=my_color,
        rated=game.rated,
        time_control_name=game.time_control_name,
        result=game.result,
        status=game.status,
        termination_reason=game.termination_reason,
        move_count=move_count,
        rating_delta=rating_delta_for_user(game, current_user_id),
        started_at=game.started_at,
        ended_at=game.ended_at,
    )


def to_game_detail_response(game, moves: Iterable, players: PlayerDirectory, clock_payload: dict) -> GameDetailResponse:
    move_list = list(moves)
    return GameDetailResponse(
        id=str(game.id),
        white=players.detail(game.white_id),
        black=players.detail(game.black_id),
        rated=game.rated,
        time_control_name=game.time_control_name,
        status=game.status,
        termination_reason=game.termination_reason,
        result=game.result,
        fen=game.fen,
        pgn=game.pgn,
        move_count=len(move_list),
        clock=ClockStateResponse(**clock_payload),
        white_rating=rating_summary(game.white_rating_before, game.white_rating_after),
        black_rating=rating_summary(game.black_rating_before, game.black_rating_after),
        started_at=game.started_at,
        ended_at=game.ended_at,
        moves=[
            MoveResponse(
                user_id=str(move.user_id),
                username=players.detail(move.user_id).username,
                uci=move.uci,
                fen_after=move.fen_after,
                move_number=move.move_number,
                created_at=move.created_at,
            )
            for move in move_list
        ],
    )


def player_directory_from_users(users: Mapping[UUID, object]) -> PlayerDirectory:
    return PlayerDirectory(
        players={
            user_id: PlayerDetail(
                id=str(user_id),
                username=user.username,
                rating=user.rating,
                avatar_url=user.avatar_path,
            )
            for user_id, user in users.items()
        }
    )


def rating_delta_for_user(game, current_user_id: UUID) -> int | None:
    if not game.rated:
        return None
    if current_user_id == game.white_id and game.white_rating_after is not None:
        return game.white_rating_after - game.white_rating_before
    if current_user_id == game.black_id and game.black_rating_after is not None:
        return game.black_rating_after - game.black_rating_before
    return None


def rating_summary(before: int, after: int | None) -> RatingSummaryResponse | None:
    if after is None:
        return None
    return RatingSummaryResponse(before=before, after=after, delta=after - before)
