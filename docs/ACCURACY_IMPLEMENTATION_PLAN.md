# Tell — Detection Accuracy Implementation Plan

Engineering plan for [`docs/ACCURACY_SPEC.md`](ACCURACY_SPEC.md). Stacked PRs, each
small and branched off the last, **each gated on measured dev metrics** (never
merge a change that doesn't help on dev or that raises FPR). Numbered `APR*` so as
not to collide with the build PRs (PR0–14). Order = **measure first, then highest
ROI**. Keep the green gate (`make check`) passing; detector/eval changes are
Tier-2/3, so add Tier-1 tests for the deterministic parts.

> Golden rule still holds: the secret/mode never enter a detector or adjudicator
> prompt. Every new prompt routes its transcript through `detectors/base.render_transcript`.

---

## APR0 — Measurement foundation  ⟵ DO FIRST (you can't fix what you can't measure)
**Files:** `backend/eval/dataset.py`, new `backend/eval/splits.py`, `backend/eval/run_eval.py`, new `backend/eval/baselines.py`, `backend/tests/test_eval_infra.py`
**Build:**
- Grow `dataset.py` to ~60 rounds (~15/mode), tag `difficulty`, and **de-bias honest topics** (drop topics that naturally invite defensive answers, which manufacture false positives).
- `splits.py`: deterministic, seed-stable dev/test split (≈60/40), balanced by mode.
- `run_eval.py`: add (a) **per-detector ablation** (evaluate each detector solo via the existing `detectors=` param), (b) **N-trial variance** (run each round k× and report label-stability), (c) **confusion matrix by mode**, (d) a **zero-shot single-call baseline** (`baselines.py`: one "is this deceptive?" call) to beat.
**Gate / done when:** `make eval` prints baseline accuracy/FPR/Brier on **dev and test**, a per-detector table, and a variance number; the **baseline is committed** to the PR description. No detection change yet.
**Risk:** low. Pure measurement.

## APR1 — Variance reduction (cheap, high-impact)
**Files:** `backend/app/detectors/base.py`, `backend/app/llm.py`, `backend/app/config.py`, `backend/tests/test_sampling.py`
**Build:**
- A `sampled_assess` helper: call a detector's judgment **k times** (k≈3) and aggregate (median suspicion, majority/most-common rationale). Detector temperature → 0.
- `OPENAI_DETECTOR_MODEL` env (default to a cheaper model, e.g. `gpt-4o-mini`) so k-sampling is affordable; keep the speaker on the stronger model.
**Gate:** label-stability ≥ 0.80 on the variance metric **without** accuracy regression on dev.
**Risk:** cost/latency — cap k; cheaper detector model.

## APR2 — Adversarial cross-examiner
**Files:** `backend/app/detectors/cross_examiner.py`, `backend/tests/test_cross_examiner.py`
**Build:** make `question` two-stage — (1) **plan**: identify the single weakest or most-checkable claim so far; (2) **trap**: ask for a specific detail, a verifiable artifact, or a cross-check that a truthful speaker can give and a liar cannot. (Mockable: the plan + trap are separate `structured_call`s.)
**Gate:** accuracy on `lying` + `strategic_deception` improves on dev; FPR flat.
**Risk:** medium — more calls per turn; bound max_turns.

## APR3 — Detector calibration + few-shot (targets FPR)
**Files:** `backend/app/detectors/behavioral.py`, `backend/app/detectors/consistency.py`, `backend/tests/`
**Build:**
- Behavioral: add 2–3 **few-shot** pairs contrasting *defensive-but-honest* vs *evasive-deceptive*; state explicitly that defensiveness/brevity ≠ deception.
- Consistency: few-shot that a **factual conflict** is a contradiction but **added detail / elaboration is not**; tighten the contradiction definition to cut honest false positives.
**Gate:** FPR drops on dev; no overall accuracy regression.
**Risk:** low.

## APR4 — Self-Consistency Prober (the skipped detector)
**Files:** new `backend/app/detectors/self_consistency.py`, `backend/app/detectors/panel.py`, `backend/tests/test_self_consistency.py`
**Build:** reword the examiner's last question 2–3 ways, resample the speaker, and measure **semantic stability** of the answers (embeddings cosine, reusing `llm.embed_text`); instability ⇒ suspicion. Add to the default panel with a weight; abstain when stable. Strong on `hallucinating` and unrehearsed lies.
**Gate:** `hallucinating` + `lying` accuracy improves on dev.
**Risk:** medium — extra speaker calls; cap reword count.

## APR5 — Calibrated fusion  ⟵ THE MONEY METRIC
**Files:** `backend/app/adjudicator.py`, new `backend/eval/calibrate.py`, `backend/tests/test_calibrate.py`
**Build:** fit, on the **dev** split, (a) per-detector weights and (b) a calibration map (Platt / temperature scaling) mapping the fused score → a calibrated probability; tune the **decision threshold** for the accuracy/FPR trade-off. Persist learned params to a small JSON the `Adjudicator` loads (fallback: today's hand weights). Keep `fuse` deterministic + unit-tested.
**Gate:** Brier ≤ 0.12 and accuracy up on **test**; documented panel-vs-single lift ≥ +10 pts on strategic.
**Risk:** medium — overfitting; mitigate with the held-out test split.

## APR6 — Evidence checker hardening
**Files:** `backend/app/llm.py` (`gather_evidence`), `backend/app/detectors/evidence_checker.py`, optional `backend/app/memory.py` (semantic cache)
**Build:** verify the Responses `web_search` tool (or swap to the W&B MCP server) actually returns evidence end-to-end; add a **RedisVL semantic cache** for repeated lookups; keep abstaining when a claim isn't checkable.
**Gate:** accuracy on evidence-checkable rounds (factual `lying`/`hallucinating`) improves; cost bounded by the cache.
**Risk:** medium — external tool/network reliability (already degrades gracefully).

---

## Dependency graph
```
APR0 (measure) ─┬─ APR1 (variance)
                ├─ APR2 (cross-examiner)
                ├─ APR3 (calibration/few-shot)
                ├─ APR4 (self-consistency)
                ├─ APR6 (evidence)
                └─ APR5 (calibrated fusion)   # do after 1–4 so it calibrates the improved signals
```
APR0 first and mandatory. APR1–3 are the highest ROI. APR5 is the calibration win and should come **after** the signal-quality levers (1–4) so it calibrates the better signals. APR4/APR6 are additive.

## How each PR proves itself
Every PR body must paste the **before/after dev metrics** (accuracy, FPR, Brier, by-mode, variance) from `make eval`, and confirm **test** didn't regress FPR. Merge only on a real, measured improvement.

## If time is short (cut order)
1. APR0 + APR1 + APR3 — measurement + variance + FPR calibration: the cheapest path to a believable, stable demo.
2. Add APR2 (adversarial questioning) for the strategic-deception accuracy.
3. APR5 (calibrated fusion) for the Brier/W&B story.
4. APR4 / APR6 only if time remains.

**Never cut:** APR0 (measurement) — without it, every later change is guesswork.
