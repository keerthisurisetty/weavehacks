"""Shared detector machinery.

``render_transcript`` is the trust boundary: detectors only ever see public
transcript text + ids here — never the secret or the mode. Every detector
renders its input through this function.
"""

from __future__ import annotations

import asyncio
import statistics
from typing import Protocol

from pydantic import BaseModel, Field

from app import llm
from app.config import settings
from app.models import DetectorSignal, Role, Utterance


class Assessment(BaseModel):
    """A detector's LLM output. The detector name + utterance_ref are attached
    by the caller (so the model never controls its own identity)."""

    suspicion: float = Field(ge=0.0, le=1.0)
    rationale: str
    evidence: str | None = None


class Detector(Protocol):
    """Any panel detector: assess a transcript, emit a suspicion signal.

    The active Cross-Examiner also asks questions; passive detectors only assess.
    """

    async def assess(self, topic: str, transcript: list[Utterance]) -> DetectorSignal: ...


def render_transcript(transcript: list[Utterance]) -> str:
    """Public text only — the line a detector is allowed to reason over."""
    if not transcript:
        return "(no statements yet)"
    out = []
    for u in transcript:
        who = "SPEAKER" if u.role is Role.SPEAKER else "EXAMINER"
        out.append(f"[{u.id}] {who}: {u.text}")
    return "\n".join(out)


def last_speaker_ref(transcript: list[Utterance]) -> str | None:
    """Id of the most recent speaker utterance (for DetectorSignal.utterance_ref)."""
    for u in reversed(transcript):
        if u.role is Role.SPEAKER:
            return u.id
    return None


async def sampled_assessment(
    messages: list[dict[str, str]],
    *,
    k: int | None = None,
    temperature: float | None = None,
    model: str | None = None,
) -> Assessment:
    """Run a detector judgment k times and aggregate, to cut single-sample variance.

    Detectors are *judges*: by default we sample at temperature 0 and take the
    MEDIAN suspicion (robust to a single outlier sample), paired with the rationale
    from the sample closest to that median (free-text rationales rarely match, so a
    "most common" vote is moot). k, temperature, and the (optionally cheaper)
    detector model come from settings unless overridden; k=1 is a single call.

    This is the APR1 variance lever — every passive detector routes its judgment
    through here so one knob controls sampling for the whole panel.
    """
    k = settings.detector_samples if k is None else k
    temperature = settings.detector_temperature if temperature is None else temperature
    model = model or llm.detector_model()

    samples = await asyncio.gather(
        *(
            llm.structured_call(messages, Assessment, model=model, temperature=temperature)
            for _ in range(max(1, k))
        )
    )
    median_suspicion = statistics.median([s.suspicion for s in samples])
    rep = min(samples, key=lambda s: abs(s.suspicion - median_suspicion))
    return Assessment(suspicion=median_suspicion, rationale=rep.rationale, evidence=rep.evidence)
