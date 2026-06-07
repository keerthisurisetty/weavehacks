"""APR5: fit the calibration map (Platt scaling) on the DEV split.

Runs the panel on dev, collects (fused suspicion, truth), grid-fits a logistic map
``sigmoid(a*x + b)`` that minimizes Brier, then tunes the decision threshold for
*balanced* accuracy (so the 75%-deceptive base rate can't game it). Writes
``app/calibration.json``, which the Adjudicator loads to produce calibrated
probabilities. Never tune on test.

    cd backend && ../.venv/bin/python -m eval.calibrate --model gpt-4o-mini --trials 3
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
from pathlib import Path

from app.config import settings

from eval.dataset import DATASET
from eval.harness import Outcome, run_suite
from eval.run_eval import panel_factory
from eval.splits import select_split

_OUT = Path(__file__).resolve().parents[1] / "app" / "calibration.json"
A_GRID = [1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0]
B_GRID = [-10.0, -9.0, -8.0, -7.0, -6.0, -5.0, -4.0, -3.0, -2.0, -1.0, 0.0]
# Search the full range: a Platt map can compress scores into a narrow band, so the
# separating threshold may sit high (~0.7-0.9), not near 0.5.
THRESHOLDS = [round(0.05 + 0.025 * i, 3) for i in range(37)]  # 0.05 .. 0.95


def _sigmoid(x: float) -> float:
    if x < 0:
        e = math.exp(x)
        return e / (1.0 + e)
    return 1.0 / (1.0 + math.exp(-x))


def _truth(o: Outcome) -> float:
    return 0.0 if o.speaker_mode == "honest" else 1.0


def _brier(outs: list[Outcome], a: float, b: float) -> float:
    return sum((_sigmoid(a * o.p_deceptive + b) - _truth(o)) ** 2 for o in outs) / len(outs)


def _balanced_acc(outs: list[Outcome], a: float, b: float, thr: float) -> float:
    """(recall on deceptive + recall on honest) / 2 — base-rate proof."""
    dec = [o for o in outs if _truth(o) == 1.0]
    hon = [o for o in outs if _truth(o) == 0.0]
    tpr = sum(_sigmoid(a * o.p_deceptive + b) >= thr for o in dec) / len(dec) if dec else 0.0
    tnr = sum(_sigmoid(a * o.p_deceptive + b) < thr for o in hon) / len(hon) if hon else 0.0
    return (tpr + tnr) / 2.0


async def main() -> None:
    p = argparse.ArgumentParser(description="Fit the APR5 calibration map on dev.")
    p.add_argument("--model", default=None)
    p.add_argument("--detector-model", default=None)
    p.add_argument("--trials", type=int, default=3)
    p.add_argument("--seed", type=int, default=1729)
    args = p.parse_args()
    if args.model:
        settings.openai_model = args.model
    if args.detector_model:
        settings.openai_detector_model = args.detector_model

    # Always collect RAW fused suspicion: remove any existing map first, else the
    # panel would emit already-calibrated scores and we'd fit a map on a map.
    _OUT.unlink(missing_ok=True)
    rows = select_split(DATASET, "dev", seed=args.seed)
    print(f"Collecting panel outcomes on dev (n={len(rows)} x {args.trials} trials)...")
    per_row = await run_suite(rows, panel_factory(), max_turns=3, trials=args.trials, concurrency=8)
    outs = [o for r in per_row for o in r]

    a, b = min(((a, b) for a in A_GRID for b in B_GRID), key=lambda ab: _brier(outs, *ab))
    thr = max(THRESHOLDS, key=lambda t: _balanced_acc(outs, a, b, t))

    raw_brier = sum((o.p_deceptive - _truth(o)) ** 2 for o in outs) / len(outs)
    cal_brier = _brier(outs, a, b)
    print(f"fit: a={a} b={b} threshold={thr}")
    print(f"dev Brier: raw {raw_brier:.3f} -> calibrated {cal_brier:.3f}")
    print(f"dev balanced-accuracy @ threshold: {_balanced_acc(outs, a, b, thr):.3f}")

    _OUT.write_text(json.dumps({"a": a, "b": b, "threshold": thr}, indent=2) + "\n")
    print(f"wrote {_OUT}")


if __name__ == "__main__":
    asyncio.run(main())
