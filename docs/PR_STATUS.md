# PR status — the autonomous loop's source of truth

One line per PR. Tick a box only when the green gate passes **and** the PR's
"done when" (from `docs/IMPLEMENTATION_PLAN.md`) is met.

- [x] PR0 scaffold + env + tooling
- [x] PR1 domain models + config
- [x] PR2 weave bootstrap + traced LLM client
- [x] PR3 speaker agent (assignable secret + mode)
- [x] PR4 first detector + adjudicator → one scored round (CLI)  ← vertical slice
- [x] PR5 redis foundation (state + leaderboard)
- [x] PR6 pub/sub event bus (real-time fan-out)
- [x] PR7 consistency auditor via RedisVL
- [x] PR8 full detector panel + ensemble fusion
- [x] PR9 weave evaluation harness  ← the money metric
- [x] PR10 AG-UI backend endpoint
- [x] PR11 courtroom frontend (functional; design restyle pending)
- [x] PR12 demo harness + polish + submission
- [x] PR13 (post-plan) UI rounds trace to Weave (weave.init at API startup)
- [x] PR14 (post-plan) real-run fixes: load .env from repo root + surface W&B key; detector abstention (no-evidence != honest); deception-only short-circuit + min turns; detector calibration; quiet weave serializer warning
- [x] PR16 (post-plan) courtroom UI rebuilt per design handoff (Neon-Noir) + live wiring: 4-detector panel "thinking" feeds, verdict spike, ground-truth reveal + Case File, HITL question injection, scripted-demo failsafe

## Accuracy track (APR*, gated on measured dev metrics — see docs/ACCURACY_IMPLEMENTATION_PLAN.md)

- [x] APR0 measurement foundation: 60-round de-biased dataset (15/mode), seed-stable dev/test split, ablation + N-trial variance + by-mode confusion + zero-shot baseline, no-weave fast path; baseline committed (docs/ACCURACY_BASELINE.md)
- [x] APR1 variance reduction: detectors run at temp 0 via a shared sampled_assessment helper + OPENAI_DETECTOR_MODEL (cheaper detectors than the speaker). Measured: same-round label stability 0.775 → 0.90 on dev (clears ≥0.80), no accuracy regression (accuracy noise is speaker-driven, ±0.08). k-sampling added nothing at temp 0 → k defaults to 1.
- [~] APR2 adversarial cross-examiner (plan → trap) — EXPLORED + REVERTED. Measured negative result: a louder/two-stage cross-examiner only slides the panel along the precision/recall curve (v1 high-recall/high-FPR 0.70; v2 moderate), it doesn't move the curve up-left in the low-FPR regime we want — v2 even lost strategic recall. Recall needs a *discriminating* signal (APR4 self-consistency) or weighted fusion (APR5), not a louder interrogation.
- [x] APR3 detector calibration + few-shot: fixed the two FPR drivers — consistency auditor (elaboration != contradiction) and behavioral analyst (defensiveness != deception); matched the decision threshold to the calibrated detectors (0.5 -> 0.40) and added an offline threshold-sweep (APR5 foundation). Measured: panel FPR 0.667 -> 0.11-0.19 on dev. Accuracy stays recall-limited (-> APR2) and Brier worse (-> APR5) — the intended post-calibration sequence.
- [ ] APR4 self-consistency prober
- [x] APR5 calibrated fusion (the money metric): adjudicator applies a learned Platt map sigmoid(a*mean+b) + tuned threshold (fit on dev by eval/calibrate.py, persisted to app/calibration.json, falls back to the raw mean when absent). Fixes the uncalibrated confidence (the Brier win).
- [ ] APR6 evidence checker hardening
