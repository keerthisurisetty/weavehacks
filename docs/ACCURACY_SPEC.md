# Tell — Detection Accuracy SPEC

> A plan to fix the **detection quality** of the panel. The architecture, tracing
> (Weave), and orchestration are solid; this doc is only about making the verdicts
> *right* and *calibrated*. Scope: backend detectors/adjudicator/eval. **Not** a
> rewrite, **not** demo-rigging, **not** abandoning black-box detection.

## 1. Problem (what we observed running it live)

Running `scripts/demo` against `gpt-4o-2024-08-06` three times scored **2/3, 1/3, 1/3**. The plumbing was flawless every time; the *verdicts* were noisy. Concrete failure modes:

- **False positives on honest rounds.** Under aggressive cross-examination an honest speaker's normal defensiveness ("I'll follow up with documentation") was read as evasion → flagged deceptive. (The most credibility-damaging error.)
- **False negatives on smooth liars.** A clean, specific, internally-consistent cover story read as honest — the panel even short-circuited to "HONEST 90%" early (now mitigated in PR14).
- **Strategic deception sometimes missed.** No literal lie ⇒ low behavioral/consistency signal ⇒ honest verdict.
- **High run-to-run variance.** Single-sample LLM judgments (temp 0.2) make the same round flip between runs.
- **Mushy confidence.** A naive weighted mean of noisy 0..1 signals clusters verdicts around 0.5–0.7, so "confidence" is barely meaningful (poor calibration / Brier).

## 2. Goals (measured on a held-out **test** split, not the demo)

| Metric | Target | Why |
|---|---|---|
| Overall accuracy | ≥ 0.85 | the headline |
| By-mode accuracy (`strategic_deception`) | ≥ 0.75 | the flex / hardest case |
| False-positive rate (honest rounds) | ≤ 0.10 | credibility — never cry wolf |
| Calibration (Brier) | ≤ 0.12 | "87%" should mean 87% |
| Label stability (same round ×5) | ≥ 80% | the demo can't be a coin flip |
| Panel − best-single (strategic) | ≥ +10 pts | proves the ensemble earns its keep |

## 3. Diagnosis (root causes)

1. **Single-sample variance** — one detector call per turn at temp 0.2.
2. **Judging in a vacuum** — detectors have no reference for what a *typical honest* answer to this question looks like.
3. **Generic cross-examination** — `cross_examiner.question` asks bland follow-ups, not targeted traps that crack a specific cover story.
4. **Behavioral conflation** — `behavioral_analyst` treats defensiveness/brevity as deception (a known weakness of behavior-only detection).
5. **Consistency edge-cases** — `consistency_auditor` can read honest *elaboration* as a contradiction (FP), and is silent on a consistent liar (by design). PR14's abstention helped the latter.
6. **Naive fusion** — `adjudicator.fuse` is a hand-weighted mean; confidence is uncalibrated; one noisy detector swings the call.
7. **No resampling** — the planned **Self-Consistency Prober** (reword/resample to expose fabrication) was skipped; hallucination + lie detection suffer.
8. **We can't measure** — `eval/dataset.py` is 24 rounds, no dev/test split, no per-detector ablation, no variance measurement, no baseline. You cannot fix what you cannot measure.

## 4. Strategy (measure first, then attack the biggest levers)

**Operating principle:** never tune on the test set. Establish a baseline, then change **one lever at a time**, measure on a **dev** split, and keep a change only if it improves dev metrics **without raising FPR**. Report on held-out **test** at the end.

- **Lever 0 — Measurement (prerequisite).** Expand + de-bias the dataset; dev/test split; per-detector ablation; N-trial variance; confusion-matrix-by-mode; a zero-shot single-call baseline to beat.
- **Lever 1 — Variance.** Self-consistency sampling per detector (k samples → median/majority); temperature 0 for detectors; a cheaper detector model to afford k; fixed seeds for the demo.
- **Lever 2 — Adversarial cross-examiner.** Two-stage *plan → trap*: find the weakest / most-checkable claim, then ask for specifics, artifacts, or a cross-check that a liar can't satisfy.
- **Lever 3 — Detector calibration + few-shot.** Behavioral: contrast defensive-honest vs evasive-deceptive examples. Consistency: factual conflict = contradiction; added detail ≠ contradiction. Targets FPR.
- **Lever 4 — Self-Consistency Prober.** Reword/resample the speaker's last answer; semantic instability ⇒ fabrication signal (esp. `hallucinating`).
- **Lever 5 — Calibrated fusion (the money metric).** Replace the hand-weighted mean: learn per-detector weights + a calibration map (Platt / temperature scaling) on dev; tune the decision threshold for the accuracy/FPR trade-off.
- **Lever 6 — Evidence checker hardening.** Confirm the Responses `web_search` tool (or W&B MCP) actually returns evidence; RedisVL semantic cache for repeat lookups; abstain cleanly when uncheckable.

## 5. Expected impact (hypotheses to validate, not promises)

- Lever 0: no accuracy change — but unlocks everything else.
- Lever 1: big variance/stability win, modest accuracy.
- Levers 2–3: the largest accuracy gains (strategic) and the largest FPR drop (honest).
- Lever 5: the largest Brier/calibration win and the cleanest panel-vs-single story.
- Levers 4 & 6: additive, mode-specific (hallucination / checkable facts).

## 6. Risks & non-goals

- **Overfitting** to a small dataset → dev/test split + held-out reporting + keep the dataset growing.
- **Cost/latency** of k-sampling and the prober → cap k, route detectors to a cheaper model.
- **Nondeterminism** → fixed seeds + always report variance, never a single run.
- **Non-goals:** changing the core architecture; tuning to make the 3 demo rounds pass (that's demo curation, separate); swapping to white-box probes (black-box dialogical detection is the project's wedge).

## 7. Definition of done

`make eval` reports, on a held-out test split, accuracy ≥ 0.85 / FPR ≤ 0.10 / Brier ≤ 0.12 with a documented panel-vs-single lift, and the same round run 5× is stable ≥ 80% of the time — with every lever's contribution shown in a per-detector ablation table in Weave.
