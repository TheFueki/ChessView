from domains.communication.domain.exceptions import MessageTooLong
from domains.game.domain.exceptions import GameNotFound, IllegalMove, NotYourTurn
from domains.identity.domain.exceptions import DuplicateEmail
from shared.exception_handlers import map_exception_to_http, map_exception_to_ws_error


def test_http_exception_mapping_for_domain_errors():
    status_code, payload = map_exception_to_http(DuplicateEmail())

    assert status_code == 409
    assert payload == {
        "detail": "Email already registered",
        "code": "DUPLICATE_EMAIL",
    }


def test_http_exception_mapping_for_missing_game():
    status_code, payload = map_exception_to_http(GameNotFound())

    assert status_code == 404
    assert payload["code"] == "NOT_FOUND"


def test_ws_exception_mapping_for_turn_violation():
    assert map_exception_to_ws_error(NotYourTurn()) == (
        "NOT_YOUR_TURN",
        "It is not your turn",
    )


def test_ws_exception_mapping_for_illegal_move():
    assert map_exception_to_ws_error(IllegalMove()) == (
        "ILLEGAL_MOVE",
        "That move is not legal in the current position",
    )


def test_ws_exception_mapping_for_chat_validation():
    assert map_exception_to_ws_error(MessageTooLong()) == (
        "MESSAGE_TOO_LONG",
        "Chat messages cannot exceed 500 characters",
    )


def test_unknown_exception_is_not_mapped():
    assert map_exception_to_http(RuntimeError("boom")) is None
    assert map_exception_to_ws_error(RuntimeError("boom")) is None
