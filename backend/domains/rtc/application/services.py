"""
RTC signaling application service.

Stateless relay   receives a signal from one peer and forwards it to the other.
Uses ConnectionManager to determine the opponent in a game room.
"""

from shared.ws_manager import ConnectionManager


class SignalingService:
    """Application service for WebRTC signaling relay."""

    def __init__(self, manager: ConnectionManager) -> None:
        self._manager = manager

    async def relay(self, game_id: str, sender_id: str, event_type: str, payload: dict) -> None:
        """
        Forward a signaling message to the opponent in the game room.

        The server does NOT inspect or modify SDP/ICE payloads.
        """
        opponent_id = self._manager.get_opponent_id(game_id, sender_id)
        if opponent_id is None:
            await self._manager.send_error(sender_id, "NOT_IN_GAME", "Opponent not found in room")
            return

        await self._manager.send_to_user(opponent_id, event_type, payload, game_id=game_id)
