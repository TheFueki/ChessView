"""Shared time-control presets used across matchmaking and tournaments."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum


@dataclass(frozen=True, slots=True)
class TimeControl:
    """Named time-control preset resolved into clock values."""

    name: str
    initial_time_ms: int
    increment_ms: int


class RatingSpeed(StrEnum):
    BULLET = "bullet"
    BLITZ = "blitz"
    RAPID = "rapid"
    CLASSICAL = "classical"


_PRESET_CATALOG = (
    TimeControl(name="1+0", initial_time_ms=60_000, increment_ms=0),
    TimeControl(name="1+1", initial_time_ms=60_000, increment_ms=1_000),
    TimeControl(name="1+2", initial_time_ms=60_000, increment_ms=2_000),
    TimeControl(name="2+1", initial_time_ms=120_000, increment_ms=1_000),
    TimeControl(name="3+0", initial_time_ms=180_000, increment_ms=0),
    TimeControl(name="3+1", initial_time_ms=180_000, increment_ms=1_000),
    TimeControl(name="3+2", initial_time_ms=180_000, increment_ms=2_000),
    TimeControl(name="5+0", initial_time_ms=300_000, increment_ms=0),
    TimeControl(name="5+3", initial_time_ms=300_000, increment_ms=3_000),
    TimeControl(name="10+0", initial_time_ms=600_000, increment_ms=0),
    TimeControl(name="15+0", initial_time_ms=900_000, increment_ms=0),
    TimeControl(name="15+10", initial_time_ms=900_000, increment_ms=10_000),
)

DEFAULT_TIME_CONTROL = next(preset for preset in _PRESET_CATALOG if preset.name == "5+0")
TIME_CONTROL_PRESETS: Mapping[str, TimeControl] = {
    preset.name: preset for preset in _PRESET_CATALOG
}


def get_time_control_preset(name: str) -> TimeControl | None:
    """Resolve a named preset into initial time and increment in milliseconds."""
    return TIME_CONTROL_PRESETS.get(name)


def make_time_control(name: str, initial_time_ms: int, increment_ms: int) -> TimeControl:
    """Build a validated custom clock value from stored tournament fields."""
    if initial_time_ms <= 0 or increment_ms < 0:
        raise ValueError("Invalid time control")
    return TimeControl(name=name, initial_time_ms=initial_time_ms, increment_ms=increment_ms)


def rating_speed_for_clock(initial_time_ms: int, increment_ms: int) -> RatingSpeed:
    """Map a clock to its Lichess-style rating speed category."""
    estimated_seconds = (initial_time_ms / 1000) + 40 * (increment_ms / 1000)
    if estimated_seconds <= 179:
        return RatingSpeed.BULLET
    if estimated_seconds <= 479:
        return RatingSpeed.BLITZ
    if estimated_seconds <= 1499:
        return RatingSpeed.RAPID
    return RatingSpeed.CLASSICAL


def rating_speed_for_time_control_name(name: str) -> RatingSpeed:
    """Resolve a preset or minutes+increment name to a rating speed category."""
    time_control = get_time_control_preset(name) or _parse_time_control_name(name) or DEFAULT_TIME_CONTROL
    return rating_speed_for_clock(time_control.initial_time_ms, time_control.increment_ms)


def _parse_time_control_name(name: str) -> TimeControl | None:
    try:
        minutes_text, increment_text = name.split("+", maxsplit=1)
        minutes = int(minutes_text)
        increment_seconds = int(increment_text)
    except (AttributeError, TypeError, ValueError):
        return None

    if minutes <= 0 or increment_seconds < 0:
        return None
    return TimeControl(name=name, initial_time_ms=minutes * 60_000, increment_ms=increment_seconds * 1000)
