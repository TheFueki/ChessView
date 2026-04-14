"""
RTC domain value objects.

Defines the signal types used in WebRTC signaling.
"""

from enum import StrEnum


class SignalType(StrEnum):
    OFFER = "offer"
    ANSWER = "answer"
    ICE_CANDIDATE = "ice_candidate"
