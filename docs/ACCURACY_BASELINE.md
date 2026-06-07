# Tell — Accuracy Baseline (APR0)

The reproduced, measured baseline the accuracy work is graded against. Established
by the APR0 measurement foundation (`backend/eval/`): a de-biased 60-round dataset,
a seed-stable dev/test split, per-detector ablation, an N-trial variance metric, a
confusion matrix by mode, and a zero-shot single-call baseline to beat.

> **Operating rule:** tune on **dev**, report final on the held-out **test** split.
> Never tune on test. Every later lever (APR1+) must improve dev metrics **without
> raising FPR** to merge.

## How to reproduce
```bash
cd backend
# fast iteration baseline (gpt-4o-mini, no Weave tracing — ~0.4 rounds/s):
../.venv/bin/python -m eval.run_eval --suite standard --split dev  --model gpt-4o-mini
../.venv/bin/python -m eval.run_eval --suite ablation --split dev  --model gpt-4o-mini
../.venv/bin/python -m eval.run_eval --suite variance --split dev  --trials 5 --model gpt-4o-mini
# canonical (the demo model):
../.venv/bin/python -m eval.run_eval --suite standard --split dev   # gpt-4o (from .env)
../.venv/bin/python -m eval.run_eval --suite standard --split test
```
`make eval` runs the standard suite on dev. Tracing is **off by default** for the
metric suites (Weave's per-op export serializes the concurrent sweep ~6×; the
harness computes every metric in Python). `--trace`, the `weave` suite, and the
demo still trace fully. `@weave.op` remains on every agent/tool/orchestrator fn.

## 1. Reproduced documented baseline (gpt-4o, original 24-round dataset)
Confirms we reproduce the numbers in `ACCURACY_SPEC.md` (acc .58 / FPR .67 / Brier .25):

| Config | Accuracy | FPR | Brier |
|---|---|---|---|
| Full panel | 0.625 | 0.333 | 0.293 |
| Single (behavioral) | 0.333 | 0.333 | 0.450 |

FPR landed at 0.33 here vs the documented 0.67 — a single-run swing that **is** the
variance problem (single-sample detectors at temp 0.2 flip between runs).

## 2. New 60-round dataset — panel vs zero-shot baseline
Dataset: 15 rounds/mode (honest / lying / strategic_deception / hallucinating),
honest topics de-biased (no alibi / fraud-accusation framing), cross-mode topical
overlap so the panel can't cheat on topic. Split: 60/40 dev/test, balanced by mode
(dev = 36, test = 24).

**gpt-4o-mini (fast iteration baseline):**

| Split · Config | Acc | FPR | Brier | honest | lying | strategic | halluc. |
|---|---|---|---|---|---|---|---|
| dev · **full panel** | 0.611 | **0.778** | 0.228 | 0.22 | 0.67 | 1.00 | 0.56 |
| dev · zero-shot baseline | 0.333 | 0.000 | 0.465 | 1.00 | 0.11 | 0.22 | 0.00 |
| test · full panel | 0.583 | 0.333 | 0.234 | 0.67 | 0.67 | 0.83 | 0.17 |
| test · zero-shot baseline | 0.333 | 0.000 | 0.448 | 1.00 | 0.17 | 0.17 | 0.00 |

**gpt-4o (canonical / demo model):**

| Split · Config | Acc | FPR | Brier | honest | lying | strategic | halluc. |
|---|---|---|---|---|---|---|---|
| dev · full panel | 0.472 | 0.333 | 0.277 | 0.67 | 0.33 | 0.67 | 0.22 |
| dev · zero-shot baseline | 0.361 | 0.111 | 0.476 | 0.89 | 0.00 | 0.56 | 0.00 |
| test · full panel | 0.625 | 0.167 | 0.248 | 0.83 | 0.50 | 0.83 | 0.33 |
| test · zero-shot baseline | 0.375 | 0.000 | 0.426 | 1.00 | 0.00 | 0.50 | 0.00 |

**The two models fail in OPPOSITE directions — the key strategic finding.**
- **gpt-4o-mini over-fires** (dev FPR 0.778: flags 7/9 honest) but catches deception
  (strategic 1.00). Trigger-happy.
- **gpt-4o under-fires** (dev FPR 0.333) but **misses deception** (lying 0.33,
  hallucinating 0.22; 16/27 false negatives). Too credulous.

Both still beat their zero-shot baseline on accuracy, but their dominant error is
opposite. **Implication for iteration:** a change that cuts mini's false positives
could *worsen* gpt-4o's false negatives — so I won't tune blindly on cheap mini.
The plan's target architecture (**gpt-4o speaker + gpt-4o-mini detectors ×k**) mixes
the two; APR1 will baseline that exact config and tune against the demo model.
(FPR is also split-noisy — mini swings 0.778 dev → 0.333 test on only 6–9 honest
rounds — another reason APR1's variance reduction matters for *measurement*, not
just demos.)

## 3. Per-detector ablation (gpt-4o-mini, dev)
Each detector solo (the cross-examiner always drives questions); positive = deceptive.

| Detector (solo) | Acc | FPR | Brier | strategic |
|---|---|---|---|---|
| consistency_auditor | 0.778 | 0.889 | 0.229 | 1.00 |
| full_panel | 0.583 | 0.889 | 0.220 | 1.00 |
| behavioral_analyst | 0.500 | 0.111 | 0.391 | 0.89 |
| zero_shot | 0.361 | 0.000 | 0.430 | 0.44 |
| cross_examiner | 0.306 | 0.000 | 0.410 | 0.22 |

`panel − best-single: -0.194 overall, +0.000 strategic` (on mini).

**Read:** the detectors are mis-calibrated in opposite directions —
- **consistency_auditor over-fires** (FPR 0.889): the "added detail = contradiction"
  bug. Its high accuracy is a mirage (flagging ~everything on a 75%-deceptive set).
  → the dominant FPR driver; the target of APR3.
- **cross_examiner / zero_shot under-fire** (FPR 0, miss deception).
- **behavioral** has the best honest calibration (FPR 0.111) but mediocre accuracy.
- The panel's naive averaging of conflicting signals trails the (over-firing) best
  single → uncalibrated fusion; the target of APR5.

_(mini exaggerates the over-firing; the gpt-4o ablation is milder — on the original
dataset the panel clearly beat the single behavioral baseline, 0.625 vs 0.333.)_

## 4. Variance / label stability (same round ×5, gpt-4o-mini, dev)
**mean modal-label fraction = 0.775 · unanimous = 0.250** (8 rounds × 5 trials).
Only 25% of rounds return the same verdict all 5 times — 75% flip their label across
identical re-runs. Far below the ≥0.80 target. (Corroborated by the panel's dev
accuracy drifting 0.611↔0.583 across two runs.) → the direct target of **APR1**.

## 5. Diagnosis → lever implications (drives APR1–APR5)
1. **FPR is the #1 problem** (panel flags most honest speakers). Biggest lever:
   **APR3** — fix consistency's "elaboration = contradiction" over-firing and add
   behavioral few-shot (defensiveness ≠ deception).
2. **Run-to-run variance** is real (panel 0.611 vs 0.583 across two dev runs; FPR
   0.33↔0.67 across gpt-4o runs). Lever: **APR1** — k-sample detectors at temp 0.
3. **Uncalibrated fusion** (panel trails best single on mini; Brier ≫ 0.12 target).
   Lever: **APR5** — learned weights + Platt/temperature scaling + threshold tuning.
4. **Under-firing on smooth deception** (cross-examiner alone strategic 0.22). Lever:
   **APR2** — adversarial plan→trap questioning; **APR4** — self-consistency prober.

## Targets (held-out test, the demo model) — and the "before"
**Before (gpt-4o, held-out test): accuracy 0.625 · FPR 0.167 · Brier 0.248 ·
stability 0.775 (dev).** The bar to clear:

| Metric | Before (gpt-4o test) | Target | Gap |
|---|---|---|---|
| accuracy | 0.625 | ≥ 0.85 | +0.225 |
| FPR | 0.167 | ≤ 0.10 | −0.067 |
| Brier | 0.248 | ≤ 0.12 | −0.128 |
| label stability | 0.775 (dev) | ≥ 0.80 | +0.025 |
| panel − best-single (strategic) | +0.33 (test) | ≥ +0.10 | already clears |

(Split sizes are small — 24 test rounds, 6 honest — so single-split FPR/accuracy are
noisy: gpt-4o swings acc 0.472 dev → 0.625 test. Report both splits; don't over-read one.)
