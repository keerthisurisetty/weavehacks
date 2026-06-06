"""PR5: Redis state + leaderboard against fakeredis (Tier 1 — no real Redis)."""

import fakeredis
import pytest
from app import memory
from app.models import Mode, Round, SpeakerConfig, Verdict


@pytest.fixture
def fake() -> fakeredis.FakeAsyncRedis:
    return fakeredis.FakeAsyncRedis(decode_responses=True)


def _round(rid: str, label: str) -> Round:
    cfg = SpeakerConfig(topic="t", mode=Mode.LYING, secret="the-secret")
    rnd = Round.from_config(rid, cfg)
    rnd.verdict = Verdict(label=label, confidence=0.9, decisive_detector="cross_examiner")  # type: ignore[arg-type]
    rnd.score()
    return rnd


async def test_round_roundtrip(fake: fakeredis.FakeAsyncRedis) -> None:
    rnd = _round("r1", "deceptive")
    await memory.save_round(rnd, client=fake)
    loaded = await memory.load_round("r1", client=fake)

    assert loaded is not None
    assert loaded.id == "r1"
    assert loaded.verdict is not None and loaded.verdict.label == "deceptive"
    assert loaded.secret == "the-secret"  # full state persisted
    assert loaded.correct is True


async def test_load_missing_returns_none(fake: fakeredis.FakeAsyncRedis) -> None:
    assert await memory.load_round("nope", client=fake) is None


async def test_leaderboard_incr_and_top(fake: fakeredis.FakeAsyncRedis) -> None:
    await memory.leaderboard_incr("cross_examiner", True, client=fake)
    await memory.leaderboard_incr("cross_examiner", True, client=fake)
    await memory.leaderboard_incr("consistency", True, client=fake)
    await memory.leaderboard_incr("behavioral", False, client=fake)  # wrong -> total only

    top = dict(await memory.leaderboard_top(client=fake))
    assert top["cross_examiner"] == 2.0
    assert top["consistency"] == 1.0
    assert "behavioral" not in top  # no correct calls yet


async def test_persist_result_credits_decisive_detector(fake: fakeredis.FakeAsyncRedis) -> None:
    rnd = _round("r2", "deceptive")  # ground truth deceptive (LYING) -> correct
    await memory.persist_result(rnd, client=fake)

    assert await memory.load_round("r2", client=fake) is not None
    top = dict(await memory.leaderboard_top(client=fake))
    assert top["cross_examiner"] == 1.0
