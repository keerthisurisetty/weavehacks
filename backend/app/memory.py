"""Redis-backed round state + the detector leaderboard.

Async (redis.asyncio) throughout. Every function takes an optional ``client`` so
unit tests inject fakeredis; production uses the lazy module-level client built
from REDIS_URL. Requires Redis Stack (vector search lands in PR7).
"""

from __future__ import annotations

import redis.asyncio as aioredis

from app.config import settings
from app.models import Round

_client: aioredis.Redis | None = None

LEADERBOARD_CORRECT = "leaderboard:correct"
LEADERBOARD_TOTAL = "leaderboard:total"


def get_redis() -> aioredis.Redis:
    """Lazy module client (decode_responses -> str in/out, easy JSON)."""
    global _client
    if _client is None:
        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _client


def _round_key(rid: str) -> str:
    return f"round:{rid}"


async def save_round(rnd: Round, *, client: aioredis.Redis | None = None) -> None:
    r = client or get_redis()
    await r.set(_round_key(rnd.id), rnd.model_dump_json())


async def load_round(rid: str, *, client: aioredis.Redis | None = None) -> Round | None:
    r = client or get_redis()
    raw = await r.get(_round_key(rid))
    return Round.model_validate_json(raw) if raw else None


async def leaderboard_incr(
    detector: str, correct: bool, *, client: aioredis.Redis | None = None
) -> None:
    """Tally one call for a detector: always a total, and a hit when correct."""
    r = client or get_redis()
    await r.zincrby(LEADERBOARD_TOTAL, 1, detector)
    if correct:
        await r.zincrby(LEADERBOARD_CORRECT, 1, detector)


async def leaderboard_top(*, client: aioredis.Redis | None = None) -> list[tuple[str, float]]:
    r = client or get_redis()
    return await r.zrevrange(LEADERBOARD_CORRECT, 0, -1, withscores=True)


async def persist_result(rnd: Round, *, client: aioredis.Redis | None = None) -> None:
    """Save the round and credit its decisive detector on the leaderboard."""
    await save_round(rnd, client=client)
    v = rnd.verdict
    if v is not None and v.decisive_detector and rnd.correct is not None:
        await leaderboard_incr(v.decisive_detector, rnd.correct, client=client)
