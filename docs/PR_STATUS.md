# PR status — the autonomous loop's source of truth

One line per PR. Tick a box only when the green gate passes **and** the PR's
"done when" (from `docs/IMPLEMENTATION_PLAN.md`) is met.

- [x] PR0 scaffold + env + tooling
- [x] PR1 domain models + config
- [x] PR2 weave bootstrap + traced LLM client
- [x] PR3 speaker agent (assignable secret + mode)
- [ ] PR4 first detector + adjudicator → one scored round (CLI)  ← vertical slice
- [ ] PR5 redis foundation (state + leaderboard)
- [ ] PR6 pub/sub event bus (real-time fan-out)
- [ ] PR7 consistency auditor via RedisVL
- [ ] PR8 full detector panel + ensemble fusion
- [ ] PR9 weave evaluation harness  ← the money metric
- [ ] PR10 AG-UI backend endpoint
- [ ] PR11 copilotkit courtroom frontend
- [ ] PR12 demo harness + polish + submission
