from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import status
from fastapi.websockets import WebSocketDisconnect

from app import ws_entry
from domains.communication.presentation import ws_handler as chat_ws
from domains.game.domain.entities import Game, Move
from domains.game.presentation import ws_handler as game_ws
from domains.matchmaking.application.services import MatchPair
from domains.matchmaking.presentation import ws_handler as matchmaking_ws
from domains.rtc.presentation import ws_handler as rtc_ws
from shared.events import EventType, WSEnvelope


class RecordingManager:
    def __init__(self) -> None:
        self.connected: list[tuple[str, object]] = []
        self.disconnected: list[tuple[str, object]] = []
        self.errors: list[tuple[str, str, str]] = []
        self.sent: list[tuple[str, str, dict, str | None]] = []
        self.broadcasts: list[tuple[str, str, dict]] = []
        self.joined: list[tuple[str, str]] = []
        self.game_rooms: dict[str, set[str]] = {}
        self.current = True
        self.opponent_id: str | None = "opponent"

    async def connect(self, user_id: str, websocket: object) -> None:
        self.connected.append((user_id, websocket))

    def is_current_connection(self, _user_id: str, _websocket: object) -> bool:
        return self.current

    async def disconnect(self, user_id: str, websocket: object) -> None:
        self.disconnected.append((user_id, websocket))

    async def send_error(self, user_id: str, code: str, message: str) -> None:
        self.errors.append((user_id, code, message))

    async def send_to_user(
        self,
        user_id: str,
        event_type: str,
        payload: dict,
        game_id: str | None = None,
    ) -> None:
        self.sent.append((user_id, event_type, payload, game_id))

    async def broadcast_to_room(self, game_id: str, event_type: str, payload: dict) -> None:
        self.broadcasts.append((game_id, event_type, payload))

    def join_room(self, game_id: str, user_id: str) -> None:
        self.joined.append((game_id, user_id))
        self.game_rooms.setdefault(game_id, set()).add(user_id)

    def get_opponent_id(self, _game_id: str, _user_id: str) -> str | None:
        return self.opponent_id


class FakeWebSocket:
    def __init__(self, *, token: str | None, messages: list[str] | None = None) -> None:
        self.query_params = {} if token is None else {"token": token}
        self.messages = list(messages or [])
        self.accepted = False
        self.closed_codes: list[int] = []

    async def close(self, code: int) -> None:
        self.closed_codes.append(code)

    async def accept(self) -> None:
        self.accepted = True

    async def receive_text(self) -> str:
        if not self.messages:
            raise WebSocketDisconnect()
        return self.messages.pop(0)


@asynccontextmanager
async def fake_session_factory():
    yield object()


@pytest.mark.asyncio
async def test_ws_endpoint_authenticates_dispatches_and_maps_handler_errors(monkeypatch):
    user_id = str(uuid4())
    manager = RecordingManager()
    handled: list[tuple[str, str]] = []

    async def restore_active_room_membership(_user_id):
        return None

    async def ok_handler(envelope, handler_user_id, _session):
        handled.append((envelope.type, handler_user_id))

    async def failing_handler(_envelope, _handler_user_id, _session):
        from domains.game.domain.exceptions import NotYourTurn

        raise NotYourTurn()

    class MatchmakingService:
        async def leave_queue(self, _left_user_id):
            return None

    class GameService:
        def __init__(self, _repo) -> None:
            pass

        async def mark_disconnected(self, _disconnected_user_id):
            return None

    monkeypatch.setattr(ws_entry, "manager", manager)
    monkeypatch.setattr(ws_entry, "decode_token", lambda token: {"type": "access", "sub": user_id} if token == "good" else {"type": "refresh", "sub": user_id})
    monkeypatch.setattr(ws_entry, "_restore_active_room_membership", restore_active_room_membership)
    monkeypatch.setattr(ws_entry, "async_session_factory", fake_session_factory)
    monkeypatch.setattr(ws_entry, "EVENT_HANDLERS", {"known": ok_handler, "turn": failing_handler})
    monkeypatch.setattr("domains.matchmaking.application.services.MatchmakingService", MatchmakingService)
    monkeypatch.setattr(ws_entry, "GameService", GameService)

    missing_token = FakeWebSocket(token=None)
    await ws_entry.ws_endpoint(missing_token)  # type: ignore[arg-type]
    assert missing_token.closed_codes == [status.WS_1008_POLICY_VIOLATION]

    wrong_type = FakeWebSocket(token="refresh")
    await ws_entry.ws_endpoint(wrong_type)  # type: ignore[arg-type]
    assert wrong_type.closed_codes == [status.WS_1008_POLICY_VIOLATION]

    websocket = FakeWebSocket(
        token="good",
        messages=[
            "{bad json",
            json.dumps({"type": "unknown", "payload": {}}),
            json.dumps({"type": "known", "payload": {"ok": True}}),
            json.dumps({"type": "turn", "payload": {}}),
        ],
    )
    await ws_entry.ws_endpoint(websocket)  # type: ignore[arg-type]

    assert websocket.accepted is True
    assert manager.connected == [(user_id, websocket)]
    assert handled == [("known", user_id)]
    assert [error[1] for error in manager.errors] == [
        "INVALID_EVENT",
        "INVALID_EVENT",
        "NOT_YOUR_TURN",
    ]
    assert manager.disconnected == [(user_id, websocket)]


@pytest.mark.asyncio
async def test_matchmaking_ws_join_creates_game_and_notifies_both_players(monkeypatch):
    user_id = uuid4()
    opponent_id = uuid4()
    game = Game(white_id=opponent_id, black_id=user_id)
    manager = RecordingManager()

    class Service:
        async def join_queue(self, joined_user_id, rating, time_control_name, initial_time_ms, increment_ms):
            assert joined_user_id == user_id
            assert rating == 1510
            assert time_control_name == "5+0"
            assert initial_time_ms == 300_000
            assert increment_ms == 0
            return 2

        async def try_match(self, matched_user_id):
            assert matched_user_id == user_id
            return MatchPair(
                white_id=opponent_id,
                black_id=user_id,
                time_control_name="5+0",
                initial_time_ms=300_000,
                increment_ms=0,
            )

    class UserRepo:
        def __init__(self, _session) -> None:
            pass

        async def get_by_id(self, requested_user_id):
            return SimpleNamespace(
                id=requested_user_id,
                username="white" if requested_user_id == opponent_id else "black",
                rating=1510,
                blitz_rating=1510,
            )

    class GameService:
        def __init__(self, _repo) -> None:
            pass

        async def create_game(self, command):
            assert command.white_id == opponent_id
            assert command.black_id == user_id
            assert command.rated is True
            return game

    monkeypatch.setattr(matchmaking_ws, "manager", manager)
    monkeypatch.setattr(matchmaking_ws, "_service", Service())
    monkeypatch.setattr(matchmaking_ws, "SqlAlchemyUserRepository", UserRepo)
    monkeypatch.setattr(matchmaking_ws, "SqlAlchemyGameRepository", lambda _session: object())
    monkeypatch.setattr(matchmaking_ws, "GameService", GameService)

    await matchmaking_ws.handle_queue_join(
        WSEnvelope(type=EventType.QUEUE_JOIN, payload={"time_control": "5+0"}),
        str(user_id),
        object(),
    )

    assert manager.sent[0] == (
        str(user_id),
        EventType.QUEUE_JOINED,
        {"position": 2, "time_control": "5+0"},
        None,
    )
    assert (str(game.id), str(opponent_id)) in manager.joined
    assert (str(game.id), str(user_id)) in manager.joined
    assert {event[0] for event in manager.sent[1:]} == {str(user_id), str(opponent_id)}
    assert {event[1] for event in manager.sent[1:]} == {EventType.MATCH_FOUND}


@pytest.mark.asyncio
async def test_game_ws_move_validates_game_id_and_broadcasts_state(monkeypatch):
    user_id = uuid4()
    game_id = uuid4()
    game = Game(id=game_id, white_id=user_id, black_id=uuid4())
    move = Move(game_id=game_id, user_id=user_id, uci="e2e4", move_number=1)
    manager = RecordingManager()

    class Service:
        async def make_move(self, command):
            assert command.game_id == game_id
            assert command.user_id == user_id
            assert command.uci == "e2e4"
            return game, move

    class GameRepo:
        def __init__(self, _session) -> None:
            pass

        async def get_moves(self, requested_game_id):
            assert requested_game_id == game_id
            return [move]

    async def game_state_payload(requested_game, moves, _session):
        assert requested_game is game
        assert moves == ["e2e4"]
        return {"fen": requested_game.fen, "move_history": moves}

    monkeypatch.setattr(game_ws, "manager", manager)
    monkeypatch.setattr(game_ws, "_build_service", lambda _session: Service())
    monkeypatch.setattr(game_ws, "SqlAlchemyGameRepository", GameRepo)
    monkeypatch.setattr(game_ws, "_game_state_payload", game_state_payload)

    await game_ws.handle_move(WSEnvelope(type=EventType.MOVE, payload={}), str(user_id), object())
    assert manager.errors == [(str(user_id), "NOT_IN_GAME", "game_id is required for move")]

    await game_ws.handle_move(
        WSEnvelope(type=EventType.MOVE, game_id=str(game_id), payload={"uci": "e2e4"}),
        str(user_id),
        object(),
    )

    assert manager.broadcasts == [
        (
            str(game_id),
            EventType.GAME_STATE,
            {
                "fen": game.fen,
                "move_history": ["e2e4"],
                "last_move": {"uci": "e2e4", "move_number": 1},
            },
        )
    ]


@pytest.mark.asyncio
async def test_chat_ws_requires_room_membership_and_broadcasts_message(monkeypatch):
    user_id = uuid4()
    game_id = uuid4()
    manager = RecordingManager()

    class ChatService:
        def __init__(self, chat_repo) -> None:
            assert chat_repo is not None
            pass

        async def send_message(self, requested_game_id, requested_user_id, content):
            assert requested_game_id == game_id
            assert requested_user_id == user_id
            assert content == "hello"
            return SimpleNamespace(
                id=7,
                user_id=user_id,
                content=content,
                created_at=datetime(2026, 6, 10, tzinfo=timezone.utc),
            )

    class UserRepo:
        def __init__(self, _session) -> None:
            pass

        async def get_by_id(self, requested_user_id):
            assert requested_user_id == user_id
            return SimpleNamespace(username="alice")

    monkeypatch.setattr(chat_ws, "manager", manager)
    monkeypatch.setattr(chat_ws, "ChatService", ChatService)
    monkeypatch.setattr(chat_ws, "SqlAlchemyChatRepository", lambda _session: object())
    monkeypatch.setattr(chat_ws, "SqlAlchemyUserRepository", UserRepo)

    await chat_ws.handle_chat_send(
        WSEnvelope(type=EventType.CHAT_SEND, game_id=str(game_id), payload={"content": "hello"}),
        str(user_id),
        object(),
    )
    assert manager.errors == [(str(user_id), "NOT_IN_GAME", "You are not in this game")]

    manager.game_rooms[str(game_id)] = {str(user_id)}
    await chat_ws.handle_chat_send(
        WSEnvelope(type=EventType.CHAT_SEND, game_id=str(game_id), payload={"content": "hello"}),
        str(user_id),
        object(),
    )

    assert manager.broadcasts == [
        (
            str(game_id),
            EventType.CHAT_MESSAGE,
            {
                "id": 7,
                "user_id": str(user_id),
                "username": "alice",
                "content": "hello",
                "created_at": "2026-06-10T00:00:00+00:00",
            },
        )
    ]


@pytest.mark.asyncio
async def test_rtc_ws_requires_game_id_and_relays_signals(monkeypatch):
    user_id = str(uuid4())
    game_id = str(uuid4())
    manager = RecordingManager()
    relayed: list[tuple[str, str, str, dict]] = []

    class SignalingService:
        async def relay(self, relayed_game_id, relayed_user_id, event_type, payload):
            relayed.append((relayed_game_id, relayed_user_id, event_type, payload))

    monkeypatch.setattr(rtc_ws, "manager", manager)
    monkeypatch.setattr(rtc_ws, "_service", SignalingService())

    await rtc_ws.handle_rtc_offer(
        WSEnvelope(type=EventType.RTC_OFFER, payload={"sdp": "offer"}),
        user_id,
        object(),
    )
    assert manager.errors == [(user_id, "NOT_IN_GAME", "game_id required for RTC signaling")]

    await rtc_ws.handle_rtc_offer(
        WSEnvelope(type=EventType.RTC_OFFER, game_id=game_id, payload={"sdp": "offer"}),
        user_id,
        object(),
    )
    await rtc_ws.handle_rtc_answer(
        WSEnvelope(type=EventType.RTC_ANSWER, game_id=game_id, payload={"sdp": "answer"}),
        user_id,
        object(),
    )
    await rtc_ws.handle_rtc_ice(
        WSEnvelope(type=EventType.RTC_ICE, game_id=game_id, payload={"candidate": "ice"}),
        user_id,
        object(),
    )

    assert relayed == [
        (game_id, user_id, EventType.RTC_OFFER, {"sdp": "offer"}),
        (game_id, user_id, EventType.RTC_ANSWER, {"sdp": "answer"}),
        (game_id, user_id, EventType.RTC_ICE, {"candidate": "ice"}),
    ]
