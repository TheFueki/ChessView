"""
RTC WebSocket event handlers.

Handles: rtc_offer, rtc_answer, rtc_ice
Forwards each signal to the opponent in the game room.

Stateless relay   delegates to SignalingService. DB session accepted but unused.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from shared.events import EventType, WSEnvelope
from shared.ws_manager import manager
from domains.rtc.application.services import SignalingService

_service = SignalingService(manager)


async def handle_rtc_offer(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Relay an SDP offer to the opponent."""
    if not envelope.game_id:
        await manager.send_error(user_id, "NOT_IN_GAME", "game_id required for RTC signaling")
        return
    await _service.relay(envelope.game_id, user_id, EventType.RTC_OFFER, envelope.payload)


async def handle_rtc_answer(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Relay an SDP answer to the opponent."""
    if not envelope.game_id:
        await manager.send_error(user_id, "NOT_IN_GAME", "game_id required for RTC signaling")
        return
    await _service.relay(envelope.game_id, user_id, EventType.RTC_ANSWER, envelope.payload)


async def handle_rtc_ice(envelope: WSEnvelope, user_id: str, session: AsyncSession) -> None:
    """Relay an ICE candidate to the opponent."""
    if not envelope.game_id:
        await manager.send_error(user_id, "NOT_IN_GAME", "game_id required for RTC signaling")
        return
    await _service.relay(envelope.game_id, user_id, EventType.RTC_ICE, envelope.payload)
