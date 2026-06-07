"""Evidence Checker — verifies falsifiable claims against external evidence.

Catches lies AND hallucinations on checkable facts (a failure mode the behavioral
and consistency detectors miss). Uses web search via the Responses API; degrades
to a neutral signal when no evidence is available, so it never breaks a round.
Sees only public transcript text + the (public) topic.
"""

from __future__ import annotations

import weave

from app import llm
from app.detectors.base import last_speaker_ref, sampled_assessment
from app.models import DetectorSignal, Role, Utterance

NAME = "evidence_checker"

_SYS = (
    "You verify a speaker's claim against retrieved EVIDENCE. If the evidence "
    "contradicts or fails to support a checkable claim, raise suspicion toward 1; "
    "if it corroborates the claim, lower it. Only judge what the evidence speaks to. "
    "One-line rationale."
)


class EvidenceChecker:
    @weave.op
    async def assess(self, topic: str, transcript: list[Utterance]) -> DetectorSignal:
        claim = next((u for u in reversed(transcript) if u.role is Role.SPEAKER), None)
        if claim is None:
            return DetectorSignal(
                detector=NAME, suspicion=0.0, rationale="no claim yet", abstained=True
            )

        evidence = await llm.gather_evidence(f"Verify this claim about {topic}: {claim.text}")
        if not evidence:
            return DetectorSignal(
                detector=NAME,
                suspicion=0.5,
                rationale="no external evidence available",
                utterance_ref=claim.id,
                abstained=True,  # can't check -> don't vote
            )

        messages = [
            {"role": "system", "content": _SYS},
            {
                "role": "user",
                "content": f"CLAIM [{claim.id}]: {claim.text}\n\nEVIDENCE:\n{evidence}",
            },
        ]
        a = await sampled_assessment(messages)
        # Evidence found but inconclusive: a near-neutral score means it neither
        # corroborated nor contradicted the claim. Abstain instead of casting a
        # ~0.5 vote that, at this detector's weight, would still tug the verdict.
        # Only speak up when the evidence actually moves us off neutral.
        inconclusive = abs(a.suspicion - 0.5) < 0.15
        return DetectorSignal(
            detector=NAME,
            suspicion=a.suspicion,
            rationale=a.rationale,
            evidence=a.evidence,
            utterance_ref=last_speaker_ref(transcript),
            abstained=inconclusive,
        )
