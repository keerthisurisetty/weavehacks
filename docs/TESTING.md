# Testing strategy (built for nondeterministic AI + automated loops)

The point of this doc: give an AI coding agent an **objective, mostly-free "is it green?" signal** it can run after every change, so it can self-correct without a human. The hard part is LLM nondeterminism — so the trick is: **test the plumbing deterministically by mocking the model, and test behavior with fixtures + bounded assertions, never exact-string equality.**

## Test tiers (split by speed/cost)
Register pytest markers in `pyproject.toml`: `agent`, `eval`, `smoke`.

| Tier | Command | Cost | When |
|------|---------|------|------|
| 1 — deterministic unit | `pytest -m "not agent and not eval"` | free, fast | **every change** (the green gate) |
| 2 — agent behavior (fixtures) | `pytest -m agent` | tokens | before opening a PR |
| 3 — eval regression gate | `make eval` (threshold) | tokens | before merge |
| 4 — smoke / e2e | `pytest -m smoke` | low | before a PR |

## Tier 1 — deterministic unit tests (the bulk; AI lives here)
**The key move: route every model call through one helper (`llm.structured_call`) and monkeypatch it** to return canned Pydantic objects. Now the whole orchestration is deterministic and testable with zero tokens.
- **Models:** Pydantic validation — `confidence ∈ [0,1]`, `Mode` enum, required fields reject bad input.
- **Progress math:** given `(phase, turns_done, max_turns)` → exact %; assert **monotonic non-decreasing**; early verdict → snaps to 100. (Pure function — test it hard; it drives the progress bar.)
- **Orchestrator with mocked agents:** a round runs the full lifecycle, emits `utterance → signal → verdict` events in order, publishes progress 0→100, persists the round — all with stubbed LLM responses. This deterministically covers ~most of the system.
- **Redis:** with `fakeredis` — round set/get, leaderboard `zincrby`/`zrevrange`, and a pub/sub publish→receive roundtrip.
- **RedisVL:** inject **fixed vectors** (no real embeddings) and assert nearest-neighbor returns the planted contradicting statement.
- **Adjudicator fusion** (rule-based parts): given a set of signals → expected `label` + `decisive_detector`.
- **Eval scorers:** pure functions — `verdict_correct`, `false_positive`, `brier` with known inputs → known outputs.

## Tier 2 — agent behavior with fixtures (bounds, not exact values)
LLM output varies, so assert **direction and bounds with margin**, never equality.
- `tests/fixtures/` holds recorded transcripts: `lying_contradiction.json`, `honest.json`, `strategic_deception.json`, `hallucination.json`.
- Run a real detector on a fixture and assert ranges:
  - consistency auditor on `lying_contradiction` → `suspicion > 0.6`
  - any detector on `honest` → `suspicion < 0.4`  ← false-positive guard
  - panel verdict on clear-cut fixtures → correct `label`
- Reduce variance: `temperature=0`, seed if supported; if still flaky, run 3× and assert the **majority**.
- **Optional record/replay (VCR-style):** cache a real LLM response as a fixture so the test replays it deterministically and free — great for CI.

## Tier 3 — the eval IS your behavioral regression test
The Weave Evaluation over the 4-mode dataset doubles as the integration test for behavior. **Gate:** `make eval` fails the PR if panel **accuracy < 0.75** or **false-positive rate > 0.20** (tune to your measured baseline). This catches "a prompt tweak quietly broke strategic-deception detection," which no unit test will. You maintain it anyway because it's your demo scoreboard.

## Tier 4 — smoke
- `scripts/smoke_round.py`: one full round (mocked or real) completes, returns a verdict, and streamed progress reached 100.
- Frontend: `npm run build` succeeds and the courtroom page renders against mock state.

## Redis in CI
GitHub Actions runs `redis/redis-stack` as a service container; unit tests use `fakeredis`, smoke/integration use the service.

## What NOT to test (hackathon scope)
Don't chase coverage on prompt wording, don't snapshot LLM prose, don't pixel-test the UI. Test **contracts + math + plumbing** (deterministic) + **behavior bounds** (fixtures) + **the eval gate**. That's the proportionate set that makes autonomy safe without eating the weekend.

## Per-PR testing (what each PR must add — keeps the agent honest)
- **PR1:** model validation. **PR2:** mock test of `structured_call` parsing (+ manual smoke trace).
- **PR3:** speaker fixtures — each mode yields the right *kind* of answer (bounded).
- **PR4:** orchestrator lifecycle with mocked agents (deterministic) + one real-round smoke.
- **PR5:** Redis state + leaderboard (fakeredis). **PR6:** pub/sub roundtrip.
- **PR7:** RedisVL contradiction retrieval (fixed vectors) + a fixture agent test.
- **PR8:** each detector's fixture bounds; panel-vs-single sanity.
- **PR9:** scorer unit tests + wire the eval-gate threshold.
- **PR10:** AG-UI event-sequence shape (deterministic, against a mocked round).
- **PR11:** frontend build + render smoke. **PR12:** the seeded demo script runs deterministically.
