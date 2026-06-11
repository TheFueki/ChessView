import pytest

from shared.ws_manager import ConnectionManager


class FakeWebSocket:
    def __init__(self) -> None:
        self.closed_codes: list[int] = []
        self.sent_text: list[str] = []

    async def close(self, code: int) -> None:
        self.closed_codes.append(code)

    async def send_text(self, message: str) -> None:
        self.sent_text.append(message)


class FakeRedis:
    def __init__(self) -> None:
        self.hashes: dict[str, dict[str, str]] = {}
        self.sets: dict[str, set[str]] = {}
        self.strings: dict[str, str] = {}
        self.published: list[tuple[str, str]] = []

    async def hset(self, key: str, mapping: dict[str, object]) -> None:
        self.hashes.setdefault(key, {}).update({field: str(value) for field, value in mapping.items()})

    async def hgetall(self, key: str):
        return dict(self.hashes.get(key, {}))

    async def expire(self, _key: str, _seconds: int) -> None:
        return None

    async def sadd(self, key: str, *members: str) -> None:
        self.sets.setdefault(key, set()).update(members)

    async def srem(self, key: str, *members: str) -> None:
        for member in members:
            self.sets.setdefault(key, set()).discard(member)

    async def smembers(self, key: str):
        return set(self.sets.get(key, set()))

    async def set(self, key: str, value: str, *, ex: int | None = None, nx: bool = False) -> bool:
        if nx and key in self.strings:
            return False
        self.strings[key] = value
        return True

    async def get(self, key: str):
        return self.strings.get(key)

    async def delete(self, *keys: str) -> None:
        for key in keys:
            self.hashes.pop(key, None)
            self.sets.pop(key, None)
            self.strings.pop(key, None)

    async def publish(self, channel: str, message: str) -> None:
        self.published.append((channel, message))

    async def eval(self, _script: str, _numkeys: int, key: str, expected: str) -> int:
        connection_id = self.hashes.get(key, {}).get("connection_id")
        if connection_id == expected:
            self.hashes.pop(key, None)
            return 1
        return 0


@pytest.mark.asyncio
async def test_replaced_connection_keeps_new_socket_as_current() -> None:
    manager = ConnectionManager(redis_client=FakeRedis(), instance_id="instance-a")
    user_id = "player-1"
    game_id = "game-1"
    old_socket = FakeWebSocket()
    new_socket = FakeWebSocket()

    await manager.connect(user_id, old_socket)  # type: ignore[arg-type]
    await manager.join_room(game_id, user_id)
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
    manager = ConnectionManager(redis_client=FakeRedis(), instance_id="instance-a")
    user_id = "player-1"
    game_id = "game-1"
    socket = FakeWebSocket()

    await manager.connect(user_id, socket)  # type: ignore[arg-type]
    await manager.join_room(game_id, user_id)
    await manager.disconnect(user_id, socket)  # type: ignore[arg-type]

    assert user_id not in manager.active_connections
    assert user_id not in manager.user_game
    assert game_id not in manager.game_rooms


@pytest.mark.asyncio
async def test_connect_join_room_and_disconnect_update_redis_presence_and_rooms() -> None:
    redis = FakeRedis()
    manager = ConnectionManager(redis_client=redis, instance_id="instance-a")
    user_id = "player-1"
    game_id = "game-1"
    socket = FakeWebSocket()

    await manager.connect(user_id, socket)  # type: ignore[arg-type]
    await manager.join_room(game_id, user_id)

    presence = await redis.hgetall(f"presence:user:{user_id}")
    assert presence["instance_id"] == "instance-a"
    assert presence["game_id"] == game_id
    assert await redis.get(f"user_game:{user_id}") == game_id
    assert await redis.smembers(f"room:{game_id}:users") == {user_id}
    assert await manager.is_room_member(game_id, user_id) is True

    await manager.disconnect(user_id, socket)  # type: ignore[arg-type]

    assert await redis.hgetall(f"presence:user:{user_id}") == {}
    assert await redis.smembers(f"room:{game_id}:users") == set()


@pytest.mark.asyncio
async def test_send_to_user_publishes_to_remote_instance_when_not_connected_locally() -> None:
    redis = FakeRedis()
    manager = ConnectionManager(redis_client=redis, instance_id="instance-a")
    await redis.hset("presence:user:remote-user", mapping={"instance_id": "instance-b", "connection_id": "conn-b"})

    await manager.send_to_user("remote-user", "game_state", {"fen": "start"}, game_id="game-1")

    assert len(redis.published) == 1
    channel, message = redis.published[0]
    assert channel == "ws:instance:instance-b"
    assert '"target_user_ids": ["remote-user"]' in message
    assert '"type": "game_state"' in message


@pytest.mark.asyncio
async def test_broadcast_to_room_delivers_local_and_groups_remote_users_by_instance() -> None:
    redis = FakeRedis()
    manager = ConnectionManager(redis_client=redis, instance_id="instance-a")
    local_socket = FakeWebSocket()

    await manager.connect("local-user", local_socket)  # type: ignore[arg-type]
    await manager.join_room("game-1", "local-user")
    await redis.sadd("room:game-1:users", "remote-1", "remote-2")
    await redis.hset("presence:user:remote-1", mapping={"instance_id": "instance-b", "connection_id": "conn-1"})
    await redis.hset("presence:user:remote-2", mapping={"instance_id": "instance-b", "connection_id": "conn-2"})

    await manager.broadcast_to_room("game-1", "chat_message", {"content": "hello"})

    assert len(local_socket.sent_text) == 1
    assert len(redis.published) == 1
    assert redis.published[0][0] == "ws:instance:instance-b"
    assert '"remote-1"' in redis.published[0][1]
    assert '"remote-2"' in redis.published[0][1]
