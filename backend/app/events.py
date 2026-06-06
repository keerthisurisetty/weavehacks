"""Round events emitted by the orchestrator after each step.

Transport-agnostic: PR4 prints them (CLI), PR6 publishes them to Redis, PR10
maps them to AG-UI (utterance->TextMessage, signal/progress->StateDelta,
verdict/reveal->Custom). Keeping one flat event type keeps every transport simple.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Literal

from pydantic import BaseModel

from app.models import DetectorSignal, Label, Mode, Phase, Utterance, Verdict


class RoundEvent(BaseModel):
    kind: Literal["progress", "utterance", "signal", "verdict", "reveal"]
    phase: Phase | None = None
    progress: int | None = None  # 0..100, monotonic
    utterance: Utterance | None = None
    signal: DetectorSignal | None = None
    verdict: Verdict | None = None
    # reveal — emitted ONCE, after the verdict (the ground-truth moment). This is
    # the only event that carries the secret/mode, and only the audience sees it.
    mode: Mode | None = None
    ground_truth: Label | None = None
    secret: str | None = None
    correct: bool | None = None


# A sink consumes events as they are emitted (print, publish to Redis, AG-UI...).
EventSink = Callable[[RoundEvent], Awaitable[None]]
