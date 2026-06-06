"""PR5 smoke: persist a round + bump the leaderboard against real Redis.

Start Redis first (`make redis`), then from backend/:

    ../.venv/bin/python -m scripts.redis_smoke

Open RedisInsight at http://localhost:8001 to see round:* and leaderboard:* keys.
No model calls — just exercises memory.py.
"""

from __future__ import annotations

import asyncio

from app import memory
from app.models import Mode, Round, SpeakerConfig, Verdict


async def main() -> None:
    cfg = SpeakerConfig(topic="demo", mode=Mode.LYING, secret="the dinner was personal")
    rnd = Round.from_config("r_smoke", cfg)
    rnd.verdict = Verdict(label="deceptive", confidence=0.88, decisive_detector="cross_examiner")
    rnd.score()

    await memory.persist_result(rnd)
    loaded = await memory.load_round("r_smoke")
    assert loaded is not None and loaded.verdict is not None
    print(f"reloaded: {loaded.id} -> {loaded.verdict.label} (correct={loaded.correct})")
    print(f"leaderboard:correct -> {await memory.leaderboard_top()}")


if __name__ == "__main__":
    asyncio.run(main())
