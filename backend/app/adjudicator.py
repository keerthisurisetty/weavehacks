"""Adjudicator — fuses detector signals into a calibrated verdict.

Deterministic and rule-based on purpose: reproducible, unit-testable without a
model. Detectors are weighted by how load-bearing their method is; the verdict is
a weighted vote. APR5 adds a learned **calibration map** (Platt scaling) fit on the
dev split — it turns the raw fused suspicion into a calibrated probability and a
tuned decision threshold, which is the Brier win. The map is loaded from a small
JSON (``calibration.json``); with none present the adjudicator falls back to the
raw weighted mean + hand threshold, so it always runs. Sees signals only.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import weave

from app.models import DetectorSignal, Label, Verdict

DECISION_THRESHOLD = 0.40  # fallback threshold (used only when no calibration map)

# Method reliability weights (evidence/consistency are harder to fool than tone).
DETECTOR_WEIGHTS: dict[str, float] = {
    "cross_examiner": 1.0,
    "consistency_auditor": 1.2,
    "evidence_checker": 1.3,
    "behavioral_analyst": 0.8,
    "self_consistency": 0.9,
}
DEFAULT_WEIGHT = 1.0

_CALIBRATION_PATH = Path(__file__).resolve().parent / "calibration.json"


def load_calibration(path: Path | None = None) -> dict[str, float] | None:
    """Load the APR5 calibration map ({a, b, threshold}) if it exists, else None."""
    p = path or _CALIBRATION_PATH
    try:
        data = json.loads(p.read_text())
    except (OSError, ValueError):
        return None
    if not all(k in data for k in ("a", "b", "threshold")):
        return None
    return {"a": float(data["a"]), "b": float(data["b"]), "threshold": float(data["threshold"])}


def _sigmoid(x: float) -> float:
    if x < 0:  # numerically stable both ways
        e = math.exp(x)
        return e / (1.0 + e)
    return 1.0 / (1.0 + math.exp(-x))


class Adjudicator:
    def __init__(
        self,
        threshold: float = DECISION_THRESHOLD,
        weights: dict[str, float] | None = None,
        calibration: dict[str, float] | None = None,
    ) -> None:
        self.threshold = threshold
        self._weights = weights if weights is not None else DETECTOR_WEIGHTS
        self._cal = calibration

    def _weight(self, detector: str) -> float:
        return self._weights.get(detector, DEFAULT_WEIGHT)

    def _calibrate(self, mean: float) -> tuple[float, float]:
        """Map the raw fused suspicion -> (calibrated p_deceptive, decision threshold)."""
        if self._cal is None:
            return mean, self.threshold
        p = _sigmoid(self._cal["a"] * mean + self._cal["b"])
        return p, self._cal["threshold"]

    @weave.op
    def fuse(self, signals: list[DetectorSignal]) -> Verdict:
        # Only detectors that actually have something to say get a vote.
        active = [s for s in signals if not s.abstained]
        if not active:
            return Verdict(label="honest", confidence=0.5)

        weights = [self._weight(s.detector) for s in active]
        wsum = sum(weights)
        mean = sum(w * s.suspicion for w, s in zip(weights, active, strict=False)) / wsum

        p_deceptive, threshold = self._calibrate(mean)
        label: Label = "deceptive" if p_deceptive >= threshold else "honest"
        confidence = p_deceptive if label == "deceptive" else 1.0 - p_deceptive
        # Most decisive = furthest from "unsure" (0.5) on the RAW signal, by method weight.
        decisive = max(active, key=lambda s: self._weight(s.detector) * abs(s.suspicion - 0.5))

        return Verdict(
            label=label,
            confidence=round(confidence, 4),
            contributing_signals=[f"{s.detector}:{s.suspicion:.2f}" for s in active],
            decisive_detector=decisive.detector,
        )
