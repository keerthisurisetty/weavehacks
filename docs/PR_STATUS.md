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
