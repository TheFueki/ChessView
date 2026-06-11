import pytest

from domains.game.presentation import runtime


class FakeRedis:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    async def set(self, key: str, value: str, *, nx: bool = False, ex: int | None = None) -> bool:
        if nx and key in self.values:
            return False
        self.values[key] = value
        return True

    async def eval(self, _script: str, _numkeys: int, key: str, expected: str) -> int:
        if self.values.get(key) == expected:
            del self.values[key]
            return 1
        return 0


@pytest.mark.asyncio
async def test_game_monitor_lock_is_exclusive_and_token_released():
    redis = FakeRedis()

    assert await runtime.acquire_game_monitor_lock(redis, "owner-a", ttl_seconds=5) is True
    assert await runtime.acquire_game_monitor_lock(redis, "owner-b", ttl_seconds=5) is False

    assert await runtime.release_game_monitor_lock(redis, "owner-b") is False
    assert "lock:game-monitor" in redis.values

    assert await runtime.release_game_monitor_lock(redis, "owner-a") is True
    assert "lock:game-monitor" not in redis.values
