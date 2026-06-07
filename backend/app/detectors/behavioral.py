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
    "You detect deception from linguistic tells ALONE -- not external facts. Topic: {topic}. "
    "Deceptive tells RAISE suspicion: dodging the actual question, vague or shifting "
    "non-answers, refusing to commit, over-qualified hedging, or specifics that do not add up.\n"
    "Do NOT treat these as deception -- they are normal in HONEST speakers under pressure and "
    "must stay LOW: brevity, a flat or defensive tone, mild nervousness, irritation at being "
    "questioned, or simply not volunteering extra detail. A direct, specific answer is honest "
    "even if it is curt or annoyed. Defensiveness is not deception.\n"
    "Examples:\n"
    "- 'I already told you -- the charges were all legitimate, I can forward the receipts.' "
    "-> 0.2 (defensive but specific and cooperative).\n"
    "- 'I don't really recall, it was a while ago. Does it matter?' -> 0.8 (deflects and "
    "refuses to answer a checkable question).\n"
    "- 'Yes. Variant B won by 3%, p<0.05.' -> 0.1 (curt but direct and specific).\n"
    "Default low; reserve suspicion above 0.5 for clear evasion. One-line rationale; cite the "
    "most telling statement id."
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
