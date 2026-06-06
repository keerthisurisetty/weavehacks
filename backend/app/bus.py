"""Redis pub/sub event bus — the real-time fan-out that drives the live meters.

Each speaker utterance is published; passive detectors subscribe and react;
detector signals are published back for the adjudicator's aggregator and the UI.
Pub/sub is fire-and-forget (no history) — fine for live meters.

Consumers use ``subscribe`` (built on pubsub.listen(), which delivers reliably);
producers use the ``publish_*`` helpers or an event sink that bridges the
orchestrator's RoundEvents straight onto channels.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

import redis.asyncio as aioredis

from app.detectors.base import Detector
from app.events import EventSink, RoundEvent
from app.memory import get_redis
from app.models import DetectorSignal, Phase, Role, Utterance, Verdict


def utterance_channel(rid: str) -> str:
    return f"round:{rid}:utterance"


def signal_channel(rid: str) -> str:
    return f"round:{rid}:signal"


def progress_channel(rid: str) -> str:
    return f"round:{rid}:progress"


def verdict_channel(rid: str) -> str:
    return f"round:{rid}:verdict"


async def publish_utterance(
    rid: str, u: Utterance, *, client: aioredis.Redis | None = None
) -> None:
    await (client or get_redis()).publish(utterance_channel(rid), u.model_dump_json())


async def publish_signal(
    rid: str, s: DetectorSignal, *, client: aioredis.Redis | None = None
) -> None:
    await (client or get_redis()).publish(signal_channel(rid), s.model_dump_json())


async def publish_verdict(rid: str, v: Verdict, *, client: aioredis.Redis | None = None) -> None:
    await (client or get_redis()).publish(verdict_channel(rid), v.model_dump_json())


async def publish_progress(
    rid: str, phase: Phase, progress: int, *, client: aioredis.Redis | None = None
) -> None:
    payload = json.dumps({"phase": str(phase), "progress": progress})
    await (client or get_redis()).publish(progress_channel(rid), payload)


def make_event_sink(rid: str, *, client: aioredis.Redis | None = None) -> EventSink:
    """An EventSink that bridges orchestrator RoundEvents onto Redis channels."""

    async def sink(event: RoundEvent) -> None:
        if event.kind == "utterance" and event.utterance is not None:
            await publish_utterance(rid, event.utterance, client=client)
        elif event.kind == "signal" and event.signal is not None:
            await publish_signal(rid, event.signal, client=client)
        elif event.kind == "progress" and event.phase is not None:
            await publish_progress(rid, event.phase, event.progress or 0, client=client)
        elif event.kind == "verdict" and event.verdict is not None:
            await publish_verdict(rid, event.verdict, client=client)

    return sink


async def subscribe(
    channel: str, *, client: aioredis.Redis | None = None
) -> AsyncIterator[dict[str, Any]]:
    """Yield decoded JSON payloads published to ``channel`` until the consumer stops."""
    r = client or get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for msg in pubsub.listen():
            if msg.get("type") == "message":
                yield json.loads(msg["data"])
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()


async def collect_signals(
    rid: str, count: int, *, client: aioredis.Redis | None = None, timeout: float = 3.0
) -> list[DetectorSignal]:
    """Aggregator: collect up to ``count`` signals from the signal channel."""
    out: list[DetectorSignal] = []

    async def _run() -> None:
        async for payload in subscribe(signal_channel(rid), client=client):
            out.append(DetectorSignal(**payload))
            if len(out) >= count:
                break

    try:
        await asyncio.wait_for(_run(), timeout=timeout)
    except TimeoutError:
        pass
    return out


async def run_detector_subscriber(
    rid: str,
    topic: str,
    detector: Detector,
    *,
    client: aioredis.Redis | None = None,
    stop_after: int = 1,
    timeout: float = 5.0,
) -> list[DetectorSignal]:
    """A passive detector: subscribe to utterances; on each speaker line, assess
    and publish a signal. Returns the signals produced (also published)."""
    produced: list[DetectorSignal] = []
    transcript: list[Utterance] = []

    async def _run() -> None:
        async for payload in subscribe(utterance_channel(rid), client=client):
            u = Utterance(**payload)
            transcript.append(u)
            if u.role is Role.SPEAKER:
                sig = await detector.assess(topic, transcript)
                await publish_signal(rid, sig, client=client)
                produced.append(sig)
                if len(produced) >= stop_after:
                    break

    try:
        await asyncio.wait_for(_run(), timeout=timeout)
    except TimeoutError:
        pass
    return produced
