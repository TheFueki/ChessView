"""Async Redis client lifecycle and shared process identity."""

from __future__ import annotations

from uuid import uuid4

from app.config import settings


INSTANCE_ID = str(uuid4())

_redis_client = None


async def init_redis():
    """Create and verify the shared Redis client."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    from redis import asyncio as redis_async

    client = redis_async.from_url(settings.REDIS_URL, decode_responses=True)
    await client.ping()
    _redis_client = client
    return client


def get_redis_client():
    """Return the initialized Redis client."""
    if _redis_client is None:
        raise RuntimeError("Redis has not been initialized")
    return _redis_client


async def redis_ping() -> bool:
    """Return whether Redis responds to ping."""
    client = get_redis_client()
    return bool(await client.ping())


async def close_redis() -> None:
    """Close the shared Redis client if it exists."""
    global _redis_client
    if _redis_client is None:
        return
    await _redis_client.aclose()
    _redis_client = None
