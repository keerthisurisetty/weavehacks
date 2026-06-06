"""Round events emitted by the orchestrator after each step.

Transport-agnostic: PR4 prints them (CLI), PR6 publishes them to Redis, PR10
maps them to AG-UI (utterance->TextMessage, signal/progress->StateDelta,
verdict->Custom). Keeping one flat event type keeps every transport simple.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Literal

from pydantic import BaseModel

from app.models import DetectorSignal, Phase, Utterance, Verdict


class RoundEvent(BaseModel):
    kind: Literal["progress", "utterance", "signal", "verdict"]
    phase: Phase | None = None
    progress: int | None = None  # 0..100, monotonic
    utterance: Utterance | None = None
    signal: DetectorSignal | None = None
    verdict: Verdict | None = None


# A sink consumes events as they are emitted (print, publish to Redis, AG-UI...).
EventSink = Callable[[RoundEvent], Awaitable[None]]
