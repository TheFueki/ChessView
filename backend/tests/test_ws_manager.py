import pytest

from shared.ws_manager import ConnectionManager


class FakeWebSocket:
    def __init__(self) -> None:
        self.closed_codes: list[int] = []

    async def close(self, code: int) -> None:
        self.closed_codes.append(code)


@pytest.mark.asyncio
async def test_replaced_connection_keeps_new_socket_as_current() -> None:
    manager = ConnectionManager()
    user_id = "player-1"
    game_id = "game-1"
    old_socket = FakeWebSocket()
    new_socket = FakeWebSocket()

    await manager.connect(user_id, old_socket)  # type: ignore[arg-type]
    manager.join_room(game_id, user_id)
    await manager.connect(user_id, new_socket)  # type: ignore[arg-type]

    assert old_socket.closed_codes == [4000]
    assert manager.is_current_connection(user_id, old_socket) is False  # type: ignore[arg-type]
    assert manager.is_current_connection(user_id, new_socket) is True  # type: ignore[arg-type]

    await manager.disconnect(user_id, old_socket)  # type: ignore[arg-type]

    assert manager.active_connections[user_id] is new_socket
    assert manager.user_game[user_id] == game_id
    assert user_id in manager.game_rooms[game_id]


@pytest.mark.asyncio
async def test_current_connection_disconnect_cleans_membership() -> None:
    manager = ConnectionManager()
    user_id = "player-1"
    game_id = "game-1"
    socket = FakeWebSocket()

    await manager.connect(user_id, socket)  # type: ignore[arg-type]
    manager.join_room(game_id, user_id)
    await manager.disconnect(user_id, socket)  # type: ignore[arg-type]

    assert user_id not in manager.active_connections
    assert user_id not in manager.user_game
    assert game_id not in manager.game_rooms
