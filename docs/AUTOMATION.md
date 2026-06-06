# Autonomous build loop (AI builds, tests, and opens PRs)

This repo is set up so an AI coding agent (Claude Code / Cursor — ralph-loop friendly, and explicitly allowed at WeaveHacks) can implement the PR stack **mostly unattended, with you as the merge gate.** What makes that work is a fast objective green gate + tight guardrails, not optimism. Read with `docs/IMPLEMENTATION_PLAN.md` and `docs/TESTING.md`.

## 1. Definition of Done — the green gate (`make check`)
Every change must pass this, at **zero token cost**, before any commit or PR:
```makefile
check:
	ruff check . && ruff format --check .
	mypy app || pyright
	pytest -m "not agent and not eval" -q
	cd frontend && npm run build
```
Token-costing gates run before opening the PR / merging (not on every change):
```makefile
test-agent:   ; pytest -m agent -q          # fixture behavior
eval:         ; python -m eval.run_eval      # behavioral regression threshold (Tier 3)
```
**Rule: no PR is opened unless `make check` is green AND the PR's "done when" (from the plan) is met.** This single rule is what stops an autonomous agent from producing plausible-but-broken code.

## 2. The per-PR loop (what the agent does each iteration)
1. Read `CLAUDE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/TESTING.md`; find the **next unchecked PR** in `docs/PR_STATUS.md`.
2. `git checkout -b prNN-slug` — **stacked off the previous PR's branch.**
3. Read the relevant `.claude/skills/*/SKILL.md` **before** writing code for that tech.
4. Implement **only this PR's scope** (respect the non-goals in CLAUDE.md; don't gold-plate).
5. Write the tests this PR requires (`docs/TESTING.md` → "per-PR").
6. Run `make check`; fix until green. **Cap: if not green after 6 attempts, write `BLOCKED.md` (what failed, what you tried) and STOP.**
7. Run the PR's token-costing tier if relevant (`make test-agent` / `make eval`).
8. Commit in small steps; open a PR with the template (§5); tick the box in `docs/PR_STATUS.md`.
9. **STOP for human review.** Start the next PR only if explicitly told (`AUTONOMOUS=continue`).

## 3. The standing prompt (`PROMPT.md` — fed to the agent each loop iteration)
> You are building the **Tell** project. Read `CLAUDE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/TESTING.md`, `docs/AUTOMATION.md`, and `docs/PR_STATUS.md`. Implement the **next unchecked PR only**. Read the relevant skill in `.claude/skills/` before using a technology. Write the required tests. Run `make check` and fix until green; if stuck after 6 tries, write `BLOCKED.md` and stop. Commit in small steps, open a PR using the template, tick `PR_STATUS.md`, then **STOP — do not start the next PR.** Do not modify scope beyond the current PR. **Never commit if `make check` is red. Never put the speaker's secret or mode into a detector/adjudicator prompt.**

## 4. Ralph loop (optional — for the deterministic PRs only)
A shell loop that re-runs the agent with the standing prompt; it self-selects the next PR from `PR_STATUS.md` and self-corrects via `make check`:
```bash
# loop.sh — one PR per iteration; stops on BLOCKED or for review
while true; do
  claude -p "$(cat PROMPT.md)" --dangerously-skip-permissions   # or codex/cursor equivalent
  [ -f BLOCKED.md ] && { echo "BLOCKED — human needed"; break; }
  [ "${AUTONOMOUS:-stop}" = "stop" ] && { echo "PR done — review then re-run"; break; }
done
```
Use it for the deterministic-heavy PRs (1, 4, 5, 6, 7, 9). **Babysit the integration PRs (10/11)** — see limits below.

## 5. PR description template
```
## PR NN: <title>
What & why (1–2 lines). Implements plan item PR NN.
- [ ] make check green
- [ ] PR "done when" met: <paste from plan>
- [ ] tests added: <list>
- [ ] token-costing tier run (if any): <result>
Notes / decisions / anything a human should eyeball.
```

## 6. CI — gate every PR automatically (`.github/workflows/ci.yml`)
```yaml
name: ci
on: { pull_request: {} }
jobs:
  check:
    runs-on: ubuntu-latest
    services:
      redis: { image: redis/redis-stack-server:latest, ports: ['6379:6379'] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pip install -r backend/requirements.txt
      - run: ruff check . && ruff format --check .
      - run: pytest -m "not agent and not eval" -q
        env: { REDIS_URL: redis://localhost:6379 }
      - run: cd frontend && npm ci && npm run build
```
Keep the token-costing eval in a **separate manual workflow** (`eval.yml`, `workflow_dispatch`) that uses `OPENAI_API_KEY`/`WANDB_API_KEY` repo secrets — so CI on every PR stays free.

## 7. State file (`docs/PR_STATUS.md` — the loop's source of truth)
```
- [x] PR0 scaffold
- [x] PR1 models
- [ ] PR2 weave + llm client     <-- next
- [ ] PR3 speaker
... (one line per PR)
```
PR0 creates this; the agent updates it as it goes.

## 8. Guardrails (why autonomy doesn't produce garbage)
- **Green gate is non-negotiable** — no red commits, ever.
- **Attempt cap + `BLOCKED.md`** — no infinite thrashing or token bonfire.
- **Scope fence** — current PR only; non-goals listed in CLAUDE.md.
- **Human-merge** — PRs stay open; *you* merge. No auto-merge to `main` during a hackathon.
- **Secrets are human-provided** — the agent literally can't fetch your W&B/OpenAI keys.
- **Budget** — cap turns/tokens per PR; watch spend in Weave.

## 9. Honest limits — where a human is still required
This is **not** "kick it off Friday and wake up to a winning project." Set expectations here or you'll be burned:
- **Keys & infra:** PR2 (your keys) and PR5 (your Redis) need you.
- **AG-UI integration (PR10/11):** the highest-risk piece, and tests **cannot** tell you the meters look right or the spike *pops*. Human eyes + the on-site CopilotKit engineer. Pair with the agent here.
- **API drift:** when a skill says "confirm against current docs," the agent may confidently use a stale-but-compiling signature that's wrong at an integration boundary — a human (or the sponsor engineer) catches this fastest.
- **Demo judgment (PR12):** "is this actually winning / does it pop?" is human taste; the AI can't score itself for the room.
- **Realistic operating mode:** let the loop run the deterministic PRs (1,4,5,6,7,9) with review at each merge; **pair** with it on the integration + demo PRs. You are the merge gate and the taste. Used this way, AI genuinely does the large majority of the build — just not the last 15% that decides whether you win.
