"""
Room-based WebSocket connection manager.

Responsibilities:
- Track active connections: user_id   WebSocket
- Track game rooms: game_id   set of user_ids
- Send to individual user, broadcast to room
- Send typed error events
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import WebSocket

from shared.events import EventType

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and game rooms."""

    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}
        self.game_rooms: dict[str, set[str]] = {}
        self.user_game: dict[str, str] = {}  # user_id   game_id for reconnect lookup

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        """Register a new WebSocket connection for a user."""
        previous = self.active_connections.get(user_id)
        self.active_connections[user_id] = websocket
        if previous is not None and previous is not websocket:
            try:
                await previous.close(code=4000)
            except Exception:
                pass

    def is_current_connection(self, user_id: str, websocket: WebSocket) -> bool:
        """Return whether websocket is still the active connection for user_id."""
        return self.active_connections.get(user_id) is websocket

    async def disconnect(self, user_id: str, websocket: WebSocket | None = None) -> None:
        """Remove a user's connection and clean up room memberships."""
        current = self.active_connections.get(user_id)
        if websocket is not None and current is not websocket:
            return

        self.active_connections.pop(user_id, None)
        self.user_game.pop(user_id, None)
        empty_rooms = []
        for game_id, room_users in self.game_rooms.items():
            room_users.discard(user_id)
            if not room_users:
                empty_rooms.append(game_id)
        for game_id in empty_rooms:
            del self.game_rooms[game_id]

    def join_room(self, game_id: str, user_id: str) -> None:
        """Add a user to a game room."""
        if game_id not in self.game_rooms:
            self.game_rooms[game_id] = set()
        self.game_rooms[game_id].add(user_id)
        self.user_game[user_id] = game_id

    def leave_room(self, game_id: str, user_id: str) -> None:
        """Remove a user from a game room."""
        if game_id in self.game_rooms:
            self.game_rooms[game_id].discard(user_id)
            if not self.game_rooms[game_id]:
                del self.game_rooms[game_id]
        if self.user_game.get(user_id) == game_id:
            self.user_game.pop(user_id, None)

    def get_opponent_id(self, game_id: str, user_id: str) -> str | None:
        """Return the other user_id in a two-player game room, or None."""
        room = self.game_rooms.get(game_id, set())
        others = room - {user_id}
        return next(iter(others), None)

    async def send_to_user(self, user_id: str, event_type: str, payload: dict, game_id: str | None = None) -> None:
        """Send a typed event envelope to a specific user."""
        ws = self.active_connections.get(user_id)
        if ws is None:
            return
        message = {
            "type": event_type,
            "payload": payload,
            "game_id": game_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            logger.exception("Failed to send WS event=%s to user_id=%s", event_type, user_id)
            await self.disconnect(user_id, ws)

    async def broadcast_to_room(self, game_id: str, event_type: str, payload: dict) -> None:
        """Send a typed event to all users in a game room."""
        user_ids = self.game_rooms.get(game_id, set())
        for uid in user_ids:
            await self.send_to_user(uid, event_type, payload, game_id=game_id)

    async def send_error(self, user_id: str, code: str, message: str) -> None:
        """Send an error event to a specific user."""
        await self.send_to_user(
            user_id,
            EventType.ERROR,
            {"code": code, "message": message},
        )


# Singleton instance used across the application
manager = ConnectionManager()
