"""The Weave Evaluation — the money metric.

Runs the dataset through the full panel and through a single-detector baseline,
producing accuracy / FPR / calibration (Brier) tables in the Weave UI plus the
panel-vs-single comparison. Applies a regression gate on the full panel.

Run (needs OPENAI_API_KEY + WANDB_API_KEY):  make eval
"""

from __future__ import annotations

import asyncio
import warnings
from typing import Any

import weave
from app.detectors.base import Detector
from app.detectors.behavioral import BehavioralAnalyst
from app.llm import init_weave
from app.models import Mode, SpeakerConfig
from app.orchestrator import run_round

from eval.dataset import DATASET
from eval.scorers import brier, false_positive, verdict_correct

warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

EVAL_MAX_TURNS = 3
MIN_ACCURACY = 0.75  # regression gate (tune to your measured baseline)
MAX_FPR = 0.20


class TellModel(weave.Model):
    detectors_mode: str = "full"  # "full" panel or "behavioral" single baseline

    @weave.op
    async def predict(
        self, topic: str, speaker_mode: str, secret: str, rid: str = "r_eval", **_: object
    ) -> dict[str, Any]:
        cfg = SpeakerConfig(topic=topic, mode=Mode(speaker_mode), secret=secret)
        detectors: list[Detector] | None = None
        if self.detectors_mode == "behavioral":
            detectors = [BehavioralAnalyst()]
        rnd = await run_round(cfg, detectors=detectors, rid=rid, max_turns=EVAL_MAX_TURNS)
        v = rnd.verdict
        assert v is not None
        return {"label": v.label, "confidence": v.confidence, "decisive": v.decisive_detector}


def _dig(summary: dict[str, Any], *path: str) -> float | None:
    cur: Any = summary
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur if isinstance(cur, int | float) else None


def _metrics(summary: dict[str, Any]) -> tuple[float | None, float | None, float | None]:
    acc = _dig(summary, "verdict_correct", "correct", "true_fraction")
    fpr = _dig(summary, "false_positive", "false_positive", "true_fraction")
    brier_mean = _dig(summary, "brier", "brier", "mean")
    return acc, fpr, brier_mean


def _fmt(x: float | None) -> str:
    return f"{x:.3f}" if isinstance(x, float) else "n/a"


def _report(label: str, summary: dict[str, Any]) -> tuple[float | None, float | None]:
    acc, fpr, brier_mean = _metrics(summary)
    print(f"[{label}] accuracy={_fmt(acc)}  FPR={_fmt(fpr)}  Brier={_fmt(brier_mean)}")
    print(f"  raw summary: {summary}")
    return acc, fpr


async def main() -> None:
    init_weave()
    evaluation = weave.Evaluation(dataset=DATASET, scorers=[verdict_correct, false_positive, brier])

    print(f"Evaluating {len(DATASET)} rounds — FULL PANEL ...")
    full = await evaluation.evaluate(TellModel(detectors_mode="full"))
    print(f"Evaluating {len(DATASET)} rounds — SINGLE (behavioral) baseline ...")
    single = await evaluation.evaluate(TellModel(detectors_mode="behavioral"))

    print("\n=== Tell evaluation ===")
    acc, fpr = _report("full panel", full)
    _report("single (behavioral)", single)

    if acc is not None and (acc < MIN_ACCURACY or (fpr is not None and fpr > MAX_FPR)):
        print(
            f"\nEVAL GATE FAILED: accuracy={_fmt(acc)} (>= {MIN_ACCURACY}?), FPR={_fmt(fpr)} (<= {MAX_FPR}?)"
        )
        raise SystemExit(1)
    print("\nEval gate passed (or metrics unparsed — see raw summary above).")


if __name__ == "__main__":
    asyncio.run(main())
