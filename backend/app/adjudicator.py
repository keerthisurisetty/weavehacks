"""Adjudicator — fuses detector signals into a calibrated verdict.

Deterministic and rule-based on purpose: reproducible, unit-testable without a
model, and its suspicion->confidence mapping is what PR9's calibration (Brier)
tunes. Detectors are weighted by how load-bearing their method is; the verdict is
a weighted vote, and the decisive detector is the most weighted-confident one.
It sees signals only — never the secret or mode.
"""

from __future__ import annotations

import weave

from app.models import DetectorSignal, Label, Verdict

# Matched to the APR3-calibrated detectors, which are deliberately less trigger-happy.
# On the dev threshold sweep this operating point cuts panel FPR ~0.67 -> ~0.19 while
# keeping the most deception recall (a lower 0.45 reaches FPR ~0.04 but sacrifices it).
# APR5 replaces this hand-set value with a learned + validation-tuned threshold.
DECISION_THRESHOLD = 0.40

# Method reliability weights (evidence/consistency are harder to fool than tone).
DETECTOR_WEIGHTS: dict[str, float] = {
    "cross_examiner": 1.0,
    "consistency_auditor": 1.2,
    "evidence_checker": 1.3,
    "behavioral_analyst": 0.8,
    "self_consistency": 0.9,
}
DEFAULT_WEIGHT = 1.0


class Adjudicator:
    def __init__(
        self, threshold: float = DECISION_THRESHOLD, weights: dict[str, float] | None = None
    ) -> None:
        self.threshold = threshold
        self._weights = weights if weights is not None else DETECTOR_WEIGHTS

    def _weight(self, detector: str) -> float:
        return self._weights.get(detector, DEFAULT_WEIGHT)

    @weave.op
    def fuse(self, signals: list[DetectorSignal]) -> Verdict:
        # Only detectors that actually have something to say get a vote.
        active = [s for s in signals if not s.abstained]
        if not active:
            return Verdict(label="honest", confidence=0.5)

        weights = [self._weight(s.detector) for s in active]
        wsum = sum(weights)
        mean = sum(w * s.suspicion for w, s in zip(weights, active, strict=False)) / wsum

        label: Label = "deceptive" if mean >= self.threshold else "honest"
        confidence = mean if label == "deceptive" else 1.0 - mean
        # Most decisive = furthest from "unsure" (0.5), scaled by method weight.
        decisive = max(active, key=lambda s: self._weight(s.detector) * abs(s.suspicion - 0.5))

        return Verdict(
            label=label,
            confidence=round(confidence, 4),
            contributing_signals=[f"{s.detector}:{s.suspicion:.2f}" for s in active],
            decisive_detector=decisive.detector,
        )
