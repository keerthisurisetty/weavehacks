"""Shared detector machinery.

``render_transcript`` is the trust boundary: detectors only ever see public
transcript text + ids here — never the secret or the mode. Every detector
renders its input through this function.
"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field

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
