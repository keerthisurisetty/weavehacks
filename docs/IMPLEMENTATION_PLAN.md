# Tell — Implementation Plan (stacked PRs)

Engineering plan to build **Tell** (see `docs/SPEC.md`) during WeaveHacks 4. Written as a stack of small PRs, each branching off the previous, each independently reviewable. Build order protects the core demo: the detection loop + Weave eval land before the UI, and the riskiest integration (AG-UI) is isolated with a fallback.

**Hard schedule reality:** Sat 11:15 → 9:00 PM on-site (office closes), optional remote overnight, Sun 9:00 AM → **1:00 PM submission**. Target: PRs 0–9 done by Saturday 9 PM (the whole detection engine + eval), PRs 10–12 on Sunday morning.

---

## Architecture (decisions)

- **Monorepo:** `backend/` (Python 3.11, FastAPI, async) + `frontend/` (Next.js + CopilotKit).
- **Agents:** OpenAI SDK directly with **Pydantic structured outputs**, each call wrapped in `@weave.op`. Weave auto-traces OpenAI. A **custom async orchestrator** runs a round — no agent framework, for full control and bulletproof tracing.
- **Real-time:** Redis **pub/sub** fans each speaker utterance to the detector panel; detector signals publish back. A bridge turns those signals into AG-UI **state deltas** (live meters).
- **Memory/search:** **RedisVL** vector index for the Consistency Auditor (contradiction search); **sorted sets** for the detector leaderboard.
- **Frontend:** CopilotKit reads AG-UI **shared state** → renders meters, transcript, verdict; a box lets a human ask the speaker a follow-up (HITL). **Fallback:** FastAPI WebSocket → React if AG-UI runs long.
- **Eval:** `weave.Evaluation` over a dataset of rounds across the 4 deception modes; scorers for accuracy, false-positive rate, calibration (Brier); plus a panel-vs-single comparison.

```
tell/
├─ CLAUDE.md                      # operating contract / index (read first every session)
├─ AGENTS.md                      # same content, for Cursor/Codex
├─ docs/SPEC.md                   # the design spec
├─ docs/IMPLEMENTATION_PLAN.md    # this file
├─ .claude/skills/{weave,redis,copilotkit-agui,openai}/SKILL.md
├─ docker-compose.yml             # Redis Stack
├─ backend/
│  ├─ app/ (models.py, config.py, llm.py, speaker.py, detectors/, adjudicator.py,
│  │        orchestrator.py, bus.py, memory.py, agui.py, main.py)
│  ├─ eval/ (dataset.py, scorers.py, run_eval.py)
│  └─ tests/
└─ frontend/ (Next.js + CopilotKit)
```

---

## Live progress indicator (cross-cutting)

A round shows a **progress %** as it runs — kept **separate** from the suspicion/confidence meters. Progress = how far through the interrogation we are (fills steadily to 100%); suspicion = how deceptive the speaker looks (jumps around). Two distinct UI elements. Progress uses the same shared-state transport as the meters, so it's nearly free.

**How % is computed (phase-weighted, monotonic — never goes backwards):**
- `setup` 0→5% (speaker briefed, panel subscribed)
- `interrogation` 5→75%, as `5 + 70 * turns_done / max_turns` (each cross-exam turn advances the bar)
- `deliberation` 75→95% (adjudicator fusing signals)
- `verdict` → 100%
- **Short-circuit:** if the adjudicator calls it before `max_turns` (confidence past threshold), jump straight to 100%.

**Transport:** the orchestrator publishes `{"phase","progress"}` to `round:{id}:progress` (Redis) after each step → the AG-UI bridge emits a `STATE_DELTA` at `/progress` and `/phase` (same mechanism as the suspicion deltas; see the copilotkit-agui skill) → the UI renders a bar + label ("Interrogating… 62%"). The WebSocket fallback forwards the same messages.

**Eval progress (the other place a % helps):** `eval/run_eval.py` shows a `tqdm` bar — `round 24/40 (60%)` — while the suite runs; Weave's eval UI also shows its own progress natively.

**Touches:** PR1 (add `phase` + `progress` to the streamed-state model) · PR4 (orchestrator emits after each step) · PR9 (eval CLI bar) · PR10 (`/progress` + `/phase` state deltas) · PR11 (a progress bar component, visually distinct from the suspicion meters).

---

## Prerequisites — get these BEFORE the hack starts (consolidated)

| # | What | How | Needed by |
|---|------|-----|-----------|
| P1 | **W&B account + API key** | sign up free, copy from wandb.ai/authorize; `wandb login` | PR2 |
| P2 | **OpenAI API key** | platform.openai.com (or use $50 OpenAI credits at event) | PR2 |
| P3 | **Docker** (for Redis Stack) | Docker Desktop installed | PR5 |
| P4 | **Node.js 20+** | for the Next.js frontend | PR11 |
| P5 | **Decide the model string** | set `OPENAI_MODEL` (confirm current model at event; W&B Inference is an OpenAI-compatible alt using $50 W&B credits) | PR2 |

**At the event:** fill the credits form (Alex/Anna, yellow jackets) for $50 W&B Inference + $50 OpenAI + $100 Cursor. Wire the **W&B MCP server** into Cursor (`https://mcp.withwandb.com/mcp`, bearer = your W&B key) so your coding agent can inspect traces while you build. WIFI `W&B Guest` / `Gumption`.

I'll flag any **YOU DO** action at the top of each PR. If none, it says "nothing."

---

## PR stack

### PR0 — Repo scaffold + env + tooling
**Goal:** a runnable empty skeleton both apps build from.
**Build:** monorepo dirs; `backend/` with `pyproject`/`requirements.txt` (fastapi, uvicorn, openai, weave, wandb, redis, redisvl, pydantic, numpy, pytest, python-dotenv); `frontend/` via `create-next-app`; `docker-compose.yml` (redis-stack); `.env.example`; `Makefile` (`make redis`, `make api`, `make web`, `make test`, `make eval`); move `docs/SPEC.md` + this file + skills into place.
**Tech:** repo only.
**YOU DO:** nothing (I'll generate it). Just `cp .env.example .env` and fill keys when prompted in PR2/PR5.
**Done when:** `make api` serves FastAPI `/health`; `make web` serves the Next.js default page; `make redis` brings up Redis.
**Risk:** none.

### PR1 — Domain models + config
**Goal:** the typed vocabulary everything else imports.
**Build:** `models.py` — `Mode` enum (`honest|lying|strategic_deception|hallucinating`), `SpeakerConfig`, `Utterance`, `DetectorSignal`, `Verdict`, `Round`, `EvalResult` (Pydantic, mirroring `SPEC.md §8`). `config.py` — settings from env (`OPENAI_MODEL`, `REDIS_URL`, project name).
**Tech:** Pydantic.
**YOU DO:** nothing.
**Done when:** models import; a unit test constructs each; `Verdict.confidence` validates 0–1.
**Risk:** none. *(Read the openai skill for the schema shapes.)*

### PR2 — Weave bootstrap + traced LLM client  ⟵ first integration
**Goal:** prove Weave tracing works end-to-end.
**Build:** `llm.py` — `AsyncOpenAI` client; a `@weave.op` `structured_call(messages, schema)` helper using `.beta.chat.completions.parse`; `weave.init(project)` at startup. A `scripts/smoke_weave.py` that makes one call.
**Tech:** Weave + OpenAI (see weave skill, openai skill).
**YOU DO:** **provide `WANDB_API_KEY` and `OPENAI_API_KEY`** in `.env`; run `wandb login`; confirm `OPENAI_MODEL`. ← first keys needed.
**Done when:** running the smoke script produces a trace visible in the Weave UI (share the project link — you'll need it for submission).
**Risk:** low. If structured outputs error, the model doesn't support `.parse` → change `OPENAI_MODEL`.

### PR3 — Speaker agent (assignable secret + mode)
**Goal:** a speaker that is honest / lies / strategically deceives / hallucinates on command, and can be cross-examined.
**Build:** `speaker.py` — builds the system prompt from `SpeakerConfig` (secret + mode), exposes `answer(question, history) -> Utterance`. **Secret/mode live only here.**
**Tech:** OpenAI structured outputs, `@weave.op`.
**YOU DO:** nothing.
**Done when:** a CLI script runs each mode and you can read the transcript; `lying` states a falsehood, `strategic_deception` misleads with no literal lie (eyeball a few).
**Risk:** low-medium — getting `strategic_deception` to mislead *without* a false statement takes prompt tuning. Worth it; it's the demo's flex.

### PR4 — First detector + adjudicator → one scored round (CLI)  ⟵ VERTICAL SLICE
**Goal:** the whole loop working for one detector, no UI, scored against ground truth.
**Build:** `detectors/cross_examiner.py` (asks 1–2 follow-ups, emits a `DetectorSignal`); `adjudicator.py` (fuses signals → calibrated `Verdict`); `orchestrator.py` `run_round(SpeakerConfig) -> Round` (speaker turn ↔ cross-exam loop → verdict); `scripts/run_round.py`.
**Tech:** OpenAI, Weave (the trace tree now shows round→speaker→detector→adjudicator).
**YOU DO:** nothing.
**Done when:** `python scripts/run_round.py --mode lying` prints a verdict + confidence and whether it matched ground truth, and the full trace appears in Weave. **If only this ships, you already have a demo.**
**Risk:** medium — protect time here. This is the heart.

### PR5 — Redis foundation (state + leaderboard)
**Goal:** Redis wired in for round state and the leaderboard.
**Build:** `memory.py` — async redis client from `REDIS_URL`; store/fetch round + secret state; `leaderboard_incr(detector, correct)` via sorted sets.
**Tech:** redis.asyncio (see redis skill).
**YOU DO:** **`make redis`** (Docker) and set `REDIS_URL` in `.env`. (Or Redis Cloud free-tier URL.) ← database needed here.
**Done when:** a round persists to Redis and reloads; leaderboard increments; visible in RedisInsight (localhost:8001).
**Risk:** low.

### PR6 — Pub/Sub event bus (real-time fan-out)
**Goal:** decouple speaker → detectors via pub/sub so signals stream live.
**Build:** `bus.py` — `publish_utterance`, `publish_signal`, `subscribe(channel)`; refactor the orchestrator so detectors subscribe to `round:{id}:utterance` and publish to `round:{id}:signal`; an async aggregator collects signals for the adjudicator.
**Tech:** Redis pub/sub.
**YOU DO:** nothing.
**Done when:** running a round, you can `SUBSCRIBE` in `redis-cli` and watch utterances + signals flow in real time.
**Risk:** medium — async pub/sub timing; keep one pubsub per subscriber, use `ignore_subscribe_messages=True`.

### PR7 — Consistency Auditor via RedisVL (contradiction search)
**Goal:** a detector that catches deception by finding contradictions over the transcript — the genuinely multi-capability Redis use.
**Build:** `detectors/consistency.py` — embed each statement (OpenAI), load into a RedisVL `AsyncSearchIndex`, and for each new claim run a `VectorQuery` (filtered to the round) to fetch nearest prior statements, then an LLM checks for contradiction → `DetectorSignal`.
**Tech:** RedisVL vector search + OpenAI embeddings (see redis skill, openai skill).
**YOU DO:** nothing.
**Done when:** in a lying round where the speaker contradicts itself, the auditor's suspicion rises and cites the contradicting earlier line.
**Risk:** medium — embedding dims must match the schema (1536). This PR is a strong Redis-prize signal.

### PR8 — Full detector panel + ensemble fusion  ⟵ HARNESS COMPLETE
**Goal:** the method-diverse panel that beats any single detector.
**Build:** `detectors/evidence_checker.py` (web_search or W&B MCP via Responses API — verifies checkable claims), `detectors/behavioral.py` (linguistic tells), optional `detectors/self_consistency.py` (resample/reword). Upgrade the adjudicator to weight multiple signals and pick a `decisive_detector`.
**Tech:** OpenAI (Responses API + MCP/web_search for evidence), Weave.
**YOU DO:** decide whether the Evidence Checker uses **web_search** or the **W&B MCP server** (either works; MCP is more on-brand). Nothing else.
**Done when:** all detectors emit signals into the verdict; you can run the panel vs. a single detector and see different outcomes on a hard round.
**Risk:** medium — scope creep. Ship Cross-Examiner + Consistency + Behavioral first; Evidence/Self-Consistency are additive.

### PR9 — Weave Evaluation harness  ⟵ THE MONEY METRIC
**Goal:** objective numbers: accuracy, false-positive rate, calibration, panel-vs-single.
**Build:** `eval/dataset.py` (~30–40 rounds across all 4 modes, with ground truth), `eval/scorers.py` (`verdict_correct`, `false_positive`, `brier`), `eval/run_eval.py` (a `weave.Model` wrapping `run_round`; `weave.Evaluation(dataset, scorers).evaluate(...)`; run twice — full panel vs best single detector).
**Tech:** Weave Evaluations (see weave skill).
**YOU DO:** nothing (I'll seed the dataset; you can add rounds).
**Done when:** `make eval` produces an accuracy + FPR + Brier table in Weave, and the panel-vs-single comparison shows the ensemble lift (especially on `strategic_deception`). **This is your strongest scoreboard for the W&B judges — protect it.**
**Risk:** medium — keep the dataset small but balanced across modes; deterministic seeds.

> **Saturday 9 PM target: PRs 0–9 done.** The engine detects deception with real, calibrated metrics. Everything below is the (important) presentation layer.

### PR10 — AG-UI backend endpoint  ⟵ HIGHEST INTEGRATION RISK
**Goal:** stream the round to a frontend as AG-UI events.
**Build:** `agui.py` — an SSE endpoint that emits RUN_STARTED → STATE_SNAPSHOT → (per signal) STATE_DELTA on `/suspicion/<detector>` + TEXT_MESSAGE for transcript → CUSTOM `verdict` → RUN_FINISHED; bridge `round:{id}:signal` (Redis) into state deltas; accept an inbound user message → inject as a cross-exam turn (HITL).
**Tech:** `ag-ui-protocol` + Starlette/FastAPI (see copilotkit-agui skill).
**YOU DO:** nothing.
**Done when:** `curl`-ing the SSE endpoint streams a coherent AG-UI event sequence for a full round.
**Risk:** **high.** Time-box it. Validate the wire format against the AG-UI example first. **Fallback:** a plain WebSocket that forwards signals (PR11 can consume either).

### PR11 — CopilotKit courtroom frontend
**Goal:** the demo UI — live meters, transcript, verdict, ask-the-speaker box.
**Build:** Next.js page wrapped in `<CopilotKit>`; read AG-UI shared state → a suspicion bar per detector (animated), the transcript stream, a verdict gauge that fires on the custom event; a text input that sends a follow-up question (HITL). Styling: make the meter spike at the lie unmissable.
**Tech:** CopilotKit React (see copilotkit-agui skill).
**YOU DO:** **`make web`** / `npm run dev`; confirm Node 20+. Decide CopilotKit Cloud vs self-host runtime (self-host is fine locally).
**Done when:** you run a round and watch meters move live, the verdict appear, and you can interject a question. (If using the fallback, same UI over WebSocket.)
**Risk:** high (depends on PR10). Keep the fallback. **Hard call point ~Sun 11:00:** if AG-UI isn't working, switch to WebSocket and move on — losing the CopilotKit prize beats losing the demo.

### PR12 — Demo harness + polish + submission
**Goal:** a deterministic, rehearsable 3-minute demo and a complete submission.
**Build:** `scripts/demo.py` with 3 curated, seeded rounds (honest → obvious lie → strategic near-miss the panel catches); a "reveal ground truth" step; surface the panel-vs-single + calibration views; README with run steps + the responsible-scope note; record the <2-min video (open on the meter spike — first-5-seconds hook); finalize the sponsor-usage writeup.
**Tech:** all.
**YOU DO:** rehearse 3×; record the video; submit on the Cerebral Valley platform (confirm DevPost too) **by 12:50 Sun** with the **Weave project link**.
**Done when:** the demo runs the same way every time and the submission checklist (SPEC §17) is complete.
**Risk:** medium — leave a real buffer; don't build new features Sunday after ~11:30.

---

## Dependency graph
```
PR0 → PR1 → PR2 → PR3 → PR4 ─┬→ PR5 → PR6 → PR7 → PR8 → PR9  (engine; Sat target)
                              └→ (PR9 only needs PR4 + PR8)
PR9 → PR10 → PR11 → PR12      (UI + demo; Sun)
```
PRs 5–9 build on PR4; the UI track (10–12) needs the engine but **not** every detector — if you're behind, wire the UI to whatever detectors exist.

## If you fall behind (cut order)
1. Drop detectors to the trio (Cross-Examiner + Consistency + Behavioral) — skip Evidence/Self-Consistency (PR8 partial).
2. Use the **WebSocket fallback** instead of AG-UI (PR10/11) — keep the demo, drop the CopilotKit prize.
3. Shrink the eval dataset (PR9) but keep all 4 modes represented.
**Never cut:** the live meter spike at the lie, the ground-truth reveal, and the Weave accuracy/calibration number.

## What I still need from you
- **The "utilities" list** for `SPEC.md §7` (it didn't come through earlier) — so the demo's closing application is the strongest one for your audience.
- **Model choice** (`OPENAI_MODEL`) and OpenAI-vs-W&B-Inference for the agents.
- **Evidence Checker:** web_search vs W&B MCP.
- Confirm you have a **frontend-capable teammate** for PRs 10–12 (they can start the Next.js shell in parallel during PR5–9).
