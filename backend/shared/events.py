"""
Typed WebSocket event envelope and event type registry.

This is the canonical event contract for all WS communication.
See docs/event-contract.md for full specification.
"""

from datetime import datetime, timezone
from enum import StrEnum

from pydantic import BaseModel, Field


class EventType(StrEnum):
    """All WebSocket event types used by client and server."""

    # Client → Server
    QUEUE_JOIN = "queue_join"
    QUEUE_LEAVE = "queue_leave"
    MOVE = "move"
    RESIGN = "resign"
    DRAW_OFFER = "draw_offer"
    DRAW_ACCEPT = "draw_accept"
    DRAW_DECLINE = "draw_decline"
    CHAT_SEND = "chat_send"
    RTC_OFFER = "rtc_offer"
    RTC_ANSWER = "rtc_answer"
    RTC_ICE = "rtc_ice"

    # Server → Client
    QUEUE_JOINED = "queue_joined"
    MATCH_FOUND = "match_found"
    GAME_STATE = "game_state"
    GAME_OVER = "game_over"
    DRAW_OFFERED = "draw_offered"
    DRAW_DECLINED = "draw_declined"
    CHAT_MESSAGE = "chat_message"
    ERROR = "error"


class WSEnvelope(BaseModel):
    """
    Every WebSocket frame conforms to this envelope.

    The `type` field is the routing key for the server dispatcher.
    """

    type: str
    payload: dict = Field(default_factory=dict)
    game_id: str | None = None
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
