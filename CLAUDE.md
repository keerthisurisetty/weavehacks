# CLAUDE.md — operating contract for the Tell repo
 
> Read this first, every session. It's short on purpose. The **why** lives in `docs/SPEC.md`; the **how/order** lives in `docs/IMPLEMENTATION_PLAN.md`; the **API specifics** live in `.claude/skills/`.
 
## What we're building (1 paragraph)
**Tell** — a live lie detector for AI agents. A *speaker* agent is assigned a secret and a mode (honest / lying / strategically-deceptive / hallucinating) and is interrogated by a *panel* of detector agents (cross-examiner, consistency auditor, evidence checker, behavioral analyst). Their suspicion meters update live; an adjudicator issues a calibrated verdict; the ground truth is revealed and scored. It's a WeaveHacks 4 project (multi-agent orchestration). The win rests on: a genuinely load-bearing multi-agent panel, an objective ground-truth eval (accuracy/false-positive-rate/calibration in Weave), and a perceivable demo (the meter spike at the moment of the lie).
 
## Golden rules
1. **Read the relevant skill before using a technology.** `.claude/skills/{weave,redis,copilotkit-agui,openai}/SKILL.md`. They contain the *current, verified* API patterns — do not guess signatures.
2. **The secret and the mode never enter a detector or adjudicator prompt.** They only see the transcript + signals. Violating this invalidates the whole project.
3. **Weave is required and central.** `weave.init("tell")` at startup; `@weave.op` on every agent/tool/orchestrator function. Keep the Weave project link handy (needed for submission).
4. **Work in stacked PRs, in order** (see the plan). Each PR is small, branches off the last, and must leave the repo runnable. **Commit early and often** — it's graded eligibility evidence.
5. **Protect the core.** The detection loop + eval (PRs 0–9) come before the UI. The AG-UI frontend (PRs 10–11) has a WebSocket fallback — never let the UI sink the demo.
6. **Async everywhere** in the backend (orchestrator runs detectors concurrently; Redis + OpenAI clients are async).
7. **Everything is built at the hackathon.** No pre-written feature code; this repo starts at PR0 on Saturday.
## Build workflow (autonomous — full detail in docs/AUTOMATION.md)
- **One PR at a time, stacked** off the previous branch. **STOP for human review after each PR** (continue only if told `AUTONOMOUS=continue`).
- **Green gate:** never commit unless `make check` passes (lint + typecheck + fast deterministic tests + frontend build). Open a PR only when `make check` is green **and** the PR's "done when" is met.
- **Read the relevant skill before coding a tech.** Write the PR's tests per `docs/TESTING.md`.
- If `make check` won't go green after ~6 attempts, write `BLOCKED.md` (what failed + what you tried) and stop — do not thrash.
- Track progress in `docs/PR_STATUS.md`. Ralph-loop setup + CI live in `docs/AUTOMATION.md`.
- Test nondeterministic agents by **mocking the LLM layer** for plumbing and asserting **bounds, not exact values**, on fixtures — see `docs/TESTING.md`.
## Current state
- [x] **PRs 0–12 + UI→Weave tracing (PR13); last green = PR13** — engine + UI + demo + live-UI Weave tracing (`weave.init` at API startup, guarded; tests stubbed offline). Remaining (human/keys): run smokes + `make eval`, layer in the design, record the video, submit.
## Stack (fixed)
Python 3.11 + FastAPI (async) backend · OpenAI SDK with Pydantic structured outputs · Weave (tracing + evals) · Redis Stack (pub/sub bus + RedisVL vector search + sorted sets) · Next.js + CopilotKit/AG-UI frontend (WebSocket fallback). Models via `OPENAI_MODEL` env (or W&B Inference).
 
## Commands
`make check` (the green gate: lint + typecheck + fast tests + frontend build — run before every commit) · `make redis` (Redis Stack) · `make api` (FastAPI) · `make web` (Next.js) · `make test-agent` (fixture behavior, costs tokens) · `make eval` (behavioral regression gate + the money metric).
 
## Env (.env)
`WANDB_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `REDIS_URL`. (At the event: $50 W&B Inference + $50 OpenAI + $100 Cursor credits via the form; wire the W&B MCP server into Cursor.)
 
## Pointers
- Design + rubric + demo script → `docs/SPEC.md`
- PR-by-PR build order + per-PR action items → `docs/IMPLEMENTATION_PLAN.md`
- API patterns → `.claude/skills/*/SKILL.md`
- Testing strategy (how to test nondeterministic agents) → `docs/TESTING.md`
- Autonomous build loop, green gate, ralph setup, CI → `docs/AUTOMATION.md`
- Progress checklist → `docs/PR_STATUS.md`
- Submission: Cerebral Valley platform (confirm DevPost), public repo, Weave link, <2-min video, sponsor writeup — due **1:00 PM Sunday**.