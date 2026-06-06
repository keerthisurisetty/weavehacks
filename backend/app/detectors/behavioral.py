"""Behavioral Analyst — scores linguistic tells, independent of external facts.

A different failure mode from the others: it can be fooled by a smooth liar, but
it needs no evidence and no contradiction to fire. Sees only public transcript.
"""

from __future__ import annotations

import weave

from app import llm
from app.detectors.base import Assessment, last_speaker_ref, render_transcript
from app.models import DetectorSignal, Utterance

NAME = "behavioral_analyst"

_SYS = (
    "You detect deception from linguistic tells ALONE — not external facts. Topic: {topic}. "
    "Rate how the SPEAKER talks on a 0..1 suspicion scale: hedging, evasion, over-specification, "
    "refusal to commit, deflection, and confidence/content mismatch raise it; direct, specific, "
    "willing answers lower it. One-line rationale; cite the most telling statement id as evidence."
)


class BehavioralAnalyst:
    @weave.op
    async def assess(self, topic: str, transcript: list[Utterance]) -> DetectorSignal:
        messages = [
            {"role": "system", "content": _SYS.format(topic=topic)},
            {"role": "user", "content": render_transcript(transcript)},
        ]
        a = await llm.structured_call(messages, Assessment, temperature=0.2)
        return DetectorSignal(
            detector=NAME,
            suspicion=a.suspicion,
            rationale=a.rationale,
            evidence=a.evidence,
            utterance_ref=last_speaker_ref(transcript),
        )
