"""Behavioral Analyst — scores linguistic tells, independent of external facts.

A different failure mode from the others: it can be fooled by a smooth liar, but
it needs no evidence and no contradiction to fire. Sees only public transcript.
"""

from __future__ import annotations

import weave

from app.detectors.base import last_speaker_ref, render_transcript, sampled_assessment
from app.models import DetectorSignal, Utterance

NAME = "behavioral_analyst"

_SYS = (
    "You detect deception from linguistic tells ALONE — not external facts. Topic: {topic}. "
    "Rate how the SPEAKER talks on a 0..1 suspicion scale: hedging, evasion, over-specification, "
    "refusal to commit, deflection, and confidence/content mismatch raise it; direct, specific, "
    "willing answers lower it. Default low: reserve suspicion above 0.5 for clear tells, not "
    "ordinary directness or brevity. One-line rationale; cite the most telling statement id."
)


class BehavioralAnalyst:
    @weave.op
    async def assess(self, topic: str, transcript: list[Utterance]) -> DetectorSignal:
        messages = [
            {"role": "system", "content": _SYS.format(topic=topic)},
            {"role": "user", "content": render_transcript(transcript)},
        ]
        a = await sampled_assessment(messages)
        return DetectorSignal(
            detector=NAME,
            suspicion=a.suspicion,
            rationale=a.rationale,
            evidence=a.evidence,
            utterance_ref=last_speaker_ref(transcript),
        )
