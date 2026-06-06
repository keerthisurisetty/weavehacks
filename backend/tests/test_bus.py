"""PR6: pub/sub roundtrips against fakeredis (Tier 1).

Pub/sub has no history, so each test subscribes first (in a task), then publishes.
"""

import asyncio

import fakeredis
import pytest
from app import bus
from app.events import RoundEvent
from app.models import DetectorSignal, Phase, Role, Utterance


@pytest.fixture
def fake() -> fakeredis.FakeAsyncRedis:
    return fakeredis.FakeAsyncRedis(decode_responses=True)


async def _first(channel: str, fake: fakeredis.FakeAsyncRedis) -> dict:
    """Subscribe and return the first message payload."""
    async for payload in bus.subscribe(channel, client=fake):
        return payload
    raise AssertionError("no message")


async def test_publish_subscribe_roundtrip(fake: fakeredis.FakeAsyncRedis) -> None:
    task = asyncio.create_task(_first(bus.utterance_channel("r1"), fake))
    await asyncio.sleep(0.05)  # let the subscriber subscribe before we publish
    await bus.publish_utterance("r1", Utterance(id="s1", role=Role.SPEAKER, text="hi"), client=fake)
    payload = await asyncio.wait_for(task, timeout=2.0)
    assert payload["id"] == "s1" and payload["text"] == "hi"


async def test_event_sink_routes_signal(fake: fakeredis.FakeAsyncRedis) -> None:
    task = asyncio.create_task(_first(bus.signal_channel("r2"), fake))
    await asyncio.sleep(0.05)
    sink = bus.make_event_sink("r2", client=fake)
    await sink(RoundEvent(kind="signal", signal=DetectorSignal(detector="x", suspicion=0.9)))
    payload = await asyncio.wait_for(task, timeout=2.0)
    assert payload["detector"] == "x" and payload["suspicion"] == 0.9


async def test_progress_published(fake: fakeredis.FakeAsyncRedis) -> None:
    task = asyncio.create_task(_first(bus.progress_channel("r5"), fake))
    await asyncio.sleep(0.05)
    await bus.publish_progress("r5", Phase.INTERROGATION, 42, client=fake)
    payload = await asyncio.wait_for(task, timeout=2.0)
    assert payload["progress"] == 42 and payload["phase"] == "interrogation"


async def test_collect_signals_aggregates(fake: fakeredis.FakeAsyncRedis) -> None:
    collector = asyncio.create_task(bus.collect_signals("r3", 2, client=fake, timeout=3.0))
    await asyncio.sleep(0.05)
    await bus.publish_signal("r3", DetectorSignal(detector="a", suspicion=0.8), client=fake)
    await bus.publish_signal("r3", DetectorSignal(detector="b", suspicion=0.2), client=fake)
    sigs = await collector
    assert {s.detector for s in sigs} == {"a", "b"}


async def test_detector_subscriber_assesses_speaker_lines(fake: fakeredis.FakeAsyncRedis) -> None:
    class Stub:
        async def assess(self, topic: str, transcript: list[Utterance]) -> DetectorSignal:
            return DetectorSignal(detector="stub", suspicion=0.77, utterance_ref=transcript[-1].id)

    task = asyncio.create_task(
        bus.run_detector_subscriber("r4", "topic", Stub(), client=fake, stop_after=1, timeout=3.0)
    )
    await asyncio.sleep(0.05)
    await bus.publish_utterance("r4", Utterance(id="q1", role=Role.EXAMINER, text="q"), client=fake)
    await bus.publish_utterance("r4", Utterance(id="s1", role=Role.SPEAKER, text="a"), client=fake)
    produced = await task
    assert len(produced) == 1
    assert produced[0].detector == "stub" and produced[0].utterance_ref == "s1"
