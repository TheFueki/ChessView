"""
Room-based WebSocket connection manager.

WebSocket objects remain process-local. Redis stores ephemeral presence,
room membership, and pub/sub routing data so multiple backend instances can
deliver events to users connected elsewhere.
"""

import json
import logging
import asyncio
from collections import OrderedDict, defaultdict
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import WebSocket

from infrastructure.redis import INSTANCE_ID, get_redis_client
from shared.events import EventType

logger = logging.getLogger(__name__)


DELETE_PRESENCE_IF_CONNECTION_MATCHES = """
if redis.call("HGET", KEYS[1], "connection_id") == ARGV[1] then
    return redis.call("DEL", KEYS[1])
end
return 0
"""


class ConnectionManager:
    """Manages local WebSocket connections and Redis-backed routing metadata."""

    PRESENCE_TTL_SECONDS = 90
    ROOM_TTL_SECONDS = 12 * 60 * 60
    DEDUPE_LIMIT = 2048

    def __init__(self, redis_client=None, instance_id: str = INSTANCE_ID) -> None:
        self.active_connections: dict[str, WebSocket] = {}
        self.connection_ids: dict[str, str] = {}
        self.game_rooms: dict[str, set[str]] = {}
        self.user_game: dict[str, str] = {}
        self._redis_client = redis_client
        self.instance_id = instance_id
        self._seen_message_ids: OrderedDict[str, None] = OrderedDict()

    def _redis(self):
        return self._redis_client or get_redis_client()

    @property
    def instance_channel(self) -> str:
        return f"ws:instance:{self.instance_id}"

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        """Register a new WebSocket connection for a user."""
        previous = self.active_connections.get(user_id)
        connection_id = str(uuid4())
        self.active_connections[user_id] = websocket
        self.connection_ids[user_id] = connection_id

        if previous is not None and previous is not websocket:
            try:
                await previous.close(code=4000)
            except Exception:
                pass

        await self._write_presence(user_id, connection_id)

    def is_current_connection(self, user_id: str, websocket: WebSocket) -> bool:
        """Return whether websocket is still the active connection for user_id."""
        return self.active_connections.get(user_id) is websocket

    async def disconnect(self, user_id: str, websocket: WebSocket | None = None) -> None:
        """Remove a user's current connection and clean up room memberships."""
        current = self.active_connections.get(user_id)
        if websocket is not None and current is not websocket:
            return

        connection_id = self.connection_ids.pop(user_id, None)
        self.active_connections.pop(user_id, None)
        game_id = self.user_game.pop(user_id, None)

        if connection_id is not None:
            await self._redis().eval(
                DELETE_PRESENCE_IF_CONNECTION_MATCHES,
                1,
                self._presence_key(user_id),
                connection_id,
            )

        if game_id is not None:
            await self._remove_room_membership(game_id, user_id)

        empty_rooms = []
        for room_id, room_users in self.game_rooms.items():
            room_users.discard(user_id)
            if not room_users:
                empty_rooms.append(room_id)
        for room_id in empty_rooms:
            del self.game_rooms[room_id]

    async def join_room(self, game_id: str, user_id: str) -> None:
        """Add a user to a game room locally and in Redis."""
        self.game_rooms.setdefault(game_id, set()).add(user_id)
        self.user_game[user_id] = game_id
        redis = self._redis()
        await redis.sadd(self._room_key(game_id), user_id)
        await redis.expire(self._room_key(game_id), self.ROOM_TTL_SECONDS)
        await redis.set(self._user_game_key(user_id), game_id, ex=self.ROOM_TTL_SECONDS)

        connection_id = self.connection_ids.get(user_id)
        if connection_id is not None:
            await self._write_presence(user_id, connection_id, game_id=game_id)

    async def leave_room(self, game_id: str, user_id: str) -> None:
        """Remove a user from a game room locally and in Redis."""
        if game_id in self.game_rooms:
            self.game_rooms[game_id].discard(user_id)
            if not self.game_rooms[game_id]:
                del self.game_rooms[game_id]
        if self.user_game.get(user_id) == game_id:
            self.user_game.pop(user_id, None)
        await self._remove_room_membership(game_id, user_id)

    async def get_opponent_id(self, game_id: str, user_id: str) -> str | None:
        """Return the other user_id in a two-player game room, or None."""
        room = await self._redis().smembers(self._room_key(game_id))
        others = {str(member) for member in room} - {user_id}
        return next(iter(others), None)

    async def is_room_member(self, game_id: str, user_id: str) -> bool:
        """Return whether a user is a member of the Redis-backed room."""
        room = await self._redis().smembers(self._room_key(game_id))
        return user_id in {str(member) for member in room}

    async def send_to_user(self, user_id: str, event_type: str, payload: dict, game_id: str | None = None) -> None:
        """Send a typed event envelope to a local or remote user."""
        message = self._event_envelope(event_type, payload, game_id)
        if await self._deliver_local(user_id, message):
            return

        presence = await self._redis().hgetall(self._presence_key(user_id))
        instance_id = presence.get("instance_id") if presence else None
        if instance_id and instance_id != self.instance_id:
            await self._publish_to_instance(str(instance_id), [user_id], message)

    async def broadcast_to_room(self, game_id: str, event_type: str, payload: dict) -> None:
        """Send a typed event to all users in a game room."""
        message = self._event_envelope(event_type, payload, game_id)
        room = await self._redis().smembers(self._room_key(game_id))
        remote_targets: dict[str, list[str]] = defaultdict(list)

        for raw_user_id in room:
            user_id = str(raw_user_id)
            if await self._deliver_local(user_id, message):
                continue
            presence = await self._redis().hgetall(self._presence_key(user_id))
            instance_id = presence.get("instance_id") if presence else None
            if instance_id and instance_id != self.instance_id:
                remote_targets[str(instance_id)].append(user_id)

        for instance_id, user_ids in remote_targets.items():
            await self._publish_to_instance(instance_id, user_ids, message)

    async def send_error(self, user_id: str, code: str, message: str) -> None:
        """Send an error event to a specific user."""
        await self.send_to_user(
            user_id,
            EventType.ERROR,
            {"code": code, "message": message},
        )

    async def heartbeat_once(self) -> None:
        """Refresh Redis TTLs for local connections and room memberships."""
        for user_id, connection_id in list(self.connection_ids.items()):
            await self._write_presence(user_id, connection_id, game_id=self.user_game.get(user_id))
        for game_id, user_ids in list(self.game_rooms.items()):
            if user_ids:
                await self._redis().expire(self._room_key(game_id), self.ROOM_TTL_SECONDS)

    async def run_pubsub_listener(self, stop_event) -> None:
        """Listen for remote delivery messages addressed to this backend instance."""
        redis = self._redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe(self.instance_channel)
        try:
            while not stop_event.is_set():
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if not message:
                    continue
                data = message.get("data")
                if not data:
                    continue
                await self.deliver_pubsub_payload(str(data))
        finally:
            try:
                await pubsub.unsubscribe(self.instance_channel)
            finally:
                await pubsub.aclose()

    async def run_heartbeat(self, stop_event, interval_seconds: float = 30.0) -> None:
        """Periodically refresh Redis TTLs for local connection metadata."""
        while not stop_event.is_set():
            await self.heartbeat_once()
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
            except asyncio.TimeoutError:
                continue

    async def deliver_pubsub_payload(self, raw_message: str) -> None:
        """Deliver a pub/sub payload to local target sockets."""
        try:
            payload = json.loads(raw_message)
        except json.JSONDecodeError:
            logger.warning("Ignoring malformed WS pubsub payload")
            return

        message_id = str(payload.get("message_id", ""))
        if not message_id or self._seen(message_id):
            return
        self._remember(message_id)

        event = payload.get("event")
        target_user_ids = payload.get("target_user_ids", [])
        if not isinstance(event, dict) or not isinstance(target_user_ids, list):
            return

        for user_id in target_user_ids:
            await self._deliver_local(str(user_id), event)

    async def _write_presence(self, user_id: str, connection_id: str, game_id: str | None = None) -> None:
        mapping = {
            "instance_id": self.instance_id,
            "connection_id": connection_id,
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }
        if game_id is not None:
            mapping["game_id"] = game_id
        await self._redis().hset(self._presence_key(user_id), mapping=mapping)
        await self._redis().expire(self._presence_key(user_id), self.PRESENCE_TTL_SECONDS)

    async def _remove_room_membership(self, game_id: str, user_id: str) -> None:
        redis = self._redis()
        await redis.srem(self._room_key(game_id), user_id)
        await redis.delete(self._user_game_key(user_id))

    async def _deliver_local(self, user_id: str, message: dict) -> bool:
        ws = self.active_connections.get(user_id)
        if ws is None:
            return False
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            logger.exception("Failed to send WS event=%s to user_id=%s", message.get("type"), user_id)
            await self.disconnect(user_id, ws)
        return True

    async def _publish_to_instance(self, instance_id: str, target_user_ids: list[str], event: dict) -> None:
        payload = {
            "message_id": str(uuid4()),
            "target_user_ids": target_user_ids,
            "event": event,
        }
        await self._redis().publish(f"ws:instance:{instance_id}", json.dumps(payload))

    def _event_envelope(self, event_type: str, payload: dict, game_id: str | None = None) -> dict:
        return {
            "type": event_type,
            "payload": payload,
            "game_id": game_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _seen(self, message_id: str) -> bool:
        return message_id in self._seen_message_ids

    def _remember(self, message_id: str) -> None:
        self._seen_message_ids[message_id] = None
        self._seen_message_ids.move_to_end(message_id)
        while len(self._seen_message_ids) > self.DEDUPE_LIMIT:
            self._seen_message_ids.popitem(last=False)

    @staticmethod
    def _presence_key(user_id: str) -> str:
        return f"presence:user:{user_id}"

    @staticmethod
    def _room_key(game_id: str) -> str:
        return f"room:{game_id}:users"

    @staticmethod
    def _user_game_key(user_id: str) -> str:
        return f"user_game:{user_id}"


# Singleton instance used across the application
manager = ConnectionManager()
