# AGENTS.md

> **`CLAUDE.md` is the single source of truth for this repo.** This file exists so Cursor, Codex, and other agents that look for `AGENTS.md` get pointed at it. Do not duplicate the contract here — read `CLAUDE.md` and keep edits there to avoid drift.

## Start here
1. Read [`CLAUDE.md`](CLAUDE.md) — the operating contract (golden rules, stack, commands, current state). Read it every session.
2. **Why** → [`docs/SPEC.md`](docs/SPEC.md) — design, rubric, demo script.
3. **How / order** → [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — the stacked-PR build order.
4. **API specifics** → `.claude/skills/{weave,openai,redis,copilotkit-agui}/SKILL.md` — read the relevant skill before using a technology; they hold the current, verified API patterns.

## Non-negotiables (full list in `CLAUDE.md`)
- The **secret and the mode never enter a detector or adjudicator prompt** — they only see the transcript + signals.
- **Weave is required and central**: `weave.init("tell")` at startup; `@weave.op` on every agent/tool/orchestrator function.
- Work in **stacked PRs, in order**; commit early and often; keep the repo runnable.
- **Protect the core** (detection loop + eval, PRs 0–9) before the UI; the AG-UI frontend has a WebSocket fallback.
