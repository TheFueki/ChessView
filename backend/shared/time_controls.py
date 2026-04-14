"""Shared time-control presets used across matchmaking and tournaments."""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TimeControl:
    """Named time-control preset resolved into clock values."""

    name: str
    initial_time_ms: int
    increment_ms: int


_PRESET_CATALOG = (
    TimeControl(name="3+0", initial_time_ms=180_000, increment_ms=0),
    TimeControl(name="3+2", initial_time_ms=180_000, increment_ms=2_000),
    TimeControl(name="5+0", initial_time_ms=300_000, increment_ms=0),
    TimeControl(name="5+3", initial_time_ms=300_000, increment_ms=3_000),
    TimeControl(name="10+0", initial_time_ms=600_000, increment_ms=0),
)

DEFAULT_TIME_CONTROL = next(preset for preset in _PRESET_CATALOG if preset.name == "5+0")
TIME_CONTROL_PRESETS: Mapping[str, TimeControl] = {
    preset.name: preset for preset in _PRESET_CATALOG
}


def get_time_control_preset(name: str) -> TimeControl | None:
    """Resolve a named preset into initial time and increment in milliseconds."""
    return TIME_CONTROL_PRESETS.get(name)
