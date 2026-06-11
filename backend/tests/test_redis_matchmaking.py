from uuid import uuid4

import pytest

from domains.matchmaking.application.services import MatchmakingService
from domains.matchmaking.domain.exceptions import AlreadyInQueue, NotInQueue


class FakeRedis:
    def __init__(self) -> None:
        self.hashes: dict[str, dict[str, str]] = {}
        self.zsets: dict[str, dict[str, float]] = {}
        self.strings: dict[str, str] = {}

    async def hgetall(self, key: str):
        return dict(self.hashes.get(key, {}))

    async def hset(self, key: str, mapping: dict[str, object]) -> None:
        self.hashes[key] = {field: str(value) for field, value in mapping.items()}

    async def expire(self, _key: str, _seconds: int) -> None:
        return None

    async def zadd(self, key: str, mapping: dict[str, float]) -> None:
        self.zsets.setdefault(key, {}).update(mapping)

    async def zrank(self, key: str, member: str):
        ordered = self._ordered(key)
        try:
            return ordered.index(member)
        except ValueError:
            return None

    async def zrange(self, key: str, start: int, end: int):
        ordered = self._ordered(key)
        if end == -1:
            return ordered[start:]
        return ordered[start : end + 1]

    async def zcard(self, key: str) -> int:
        return len(self.zsets.get(key, {}))

    async def zrem(self, key: str, *members: str) -> None:
        zset = self.zsets.setdefault(key, {})
        for member in members:
            zset.pop(member, None)

    async def delete(self, *keys: str) -> None:
        for key in keys:
            self.hashes.pop(key, None)
            self.zsets.pop(key, None)
            self.strings.pop(key, None)

    async def set(self, key: str, value: str, *, nx: bool = False, ex: int | None = None) -> bool:
        if nx and key in self.strings:
            return False
        self.strings[key] = value
        return True

    async def get(self, key: str):
        return self.strings.get(key)

    async def eval(self, _script: str, _numkeys: int, key: str, expected: str) -> int:
        if self.strings.get(key) == expected:
            self.strings.pop(key, None)
            return 1
        return 0

    def _ordered(self, key: str) -> list[str]:
        return [
            member
            for member, _score in sorted(
                self.zsets.get(key, {}).items(), key=lambda item: (item[1], item[0])
            )
        ]


@pytest.mark.asyncio
async def test_redis_matchmaking_rejects_duplicate_join_and_leaves_queue():
    redis = FakeRedis()
    user_id = uuid4()
    service = MatchmakingService(redis_client=redis, clock_ms=lambda: 1000)

    position = await service.join_queue(user_id, 1500, "5+0", 300_000, 0)

    assert position == 1
    with pytest.raises(AlreadyInQueue):
        await service.join_queue(user_id, 1500, "5+0", 300_000, 0)

    await service.leave_queue(user_id)

    assert await redis.hgetall(f"mm:user:{user_id}") == {}
    assert await redis.zcard("mm:queue:5+0") == 0
    with pytest.raises(NotInQueue):
        await service.leave_queue(user_id)


@pytest.mark.asyncio
async def test_redis_matchmaking_pairs_same_time_control_with_best_rating_diff():
    redis = FakeRedis()
    now = 1000

    def clock_ms() -> int:
        nonlocal now
        now += 1
        return now

    service = MatchmakingService(redis_client=redis, clock_ms=clock_ms)
    joining_user = uuid4()
    poor_match = uuid4()
    best_match = uuid4()

    await service.join_queue(poor_match, 1325, "5+0", 300_000, 0)
    await service.join_queue(best_match, 1475, "5+0", 300_000, 0)
    await service.join_queue(joining_user, 1500, "5+0", 300_000, 0)

    match = await service.try_match(joining_user)

    assert match is not None
    assert {match.white_id, match.black_id} == {joining_user, best_match}
    assert match.time_control_name == "5+0"
    assert await redis.hgetall(f"mm:user:{joining_user}") == {}
    assert await redis.hgetall(f"mm:user:{best_match}") == {}
    assert await redis.hgetall(f"mm:user:{poor_match}") != {}


@pytest.mark.asyncio
async def test_redis_matchmaking_keeps_rating_and_time_control_boundaries():
    redis = FakeRedis()
    service = MatchmakingService(redis_client=redis, clock_ms=lambda: 1000)
    joining_user = uuid4()
    different_time_control = uuid4()
    outside_rating_window = uuid4()

    await service.join_queue(different_time_control, 1510, "3+0", 180_000, 0)
    await service.join_queue(outside_rating_window, 1801, "5+0", 300_000, 0)
    await service.join_queue(joining_user, 1500, "5+0", 300_000, 0)

    assert await service.try_match(joining_user) is None
    assert await redis.zcard("mm:queue:3+0") == 1
    assert await redis.zcard("mm:queue:5+0") == 2
