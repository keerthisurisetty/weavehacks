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
- [ ] APR1 variance reduction (k-sample @ temp 0, cheaper detector model)
- [ ] APR2 adversarial cross-examiner (plan → trap)
- [ ] APR3 detector calibration + few-shot (cut FPR)
- [ ] APR4 self-consistency prober
- [ ] APR5 calibrated fusion (the money metric)
- [ ] APR6 evidence checker hardening
