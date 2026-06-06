# Tell — a live lie detector for AI agents

**A panel of AI agents interrogates any claim and catches deception the moment it leaks.** A *speaker* agent is privately assigned a secret and a mode (honest / lying / strategically-deceptive / hallucinating). A *panel* of detector agents — Cross-Examiner, Consistency Auditor, Behavioral Analyst, Evidence Checker — questions it in real time; their suspicion meters move live. An adjudicator fuses the signals into a **calibrated verdict** (*"DECEPTION — 87%"*), then the ground truth is revealed and scored.

> WeaveHacks 4 (Multi-Agent Orchestration). The win rests on a genuinely load-bearing multi-agent panel, an objective ground-truth eval (accuracy / false-positive-rate / calibration in Weave), and a perceivable demo — the meter spike at the moment of the lie.

The contribution: a **black-box, dialogical, multi-agent** interrogation targeting the *strategic-deception* blind spot that white-box truth-probes miss — with **calibrated** confidence. Full design in [`docs/SPEC.md`](docs/SPEC.md).

---

## How it works

```
speaker (secret + mode)  ──>  Redis pub/sub  ──>  detector panel (concurrent)
   ▲ cross-examined                                 ├ Cross-Examiner   (asks + scores)
   │                                                ├ Consistency Auditor (RedisVL vector search)
   └────────── follow-ups ──────────                ├ Behavioral Analyst (linguistic tells)
                                                     └ Evidence Checker  (web search)
                                                          │  live suspicion signals
                                                          ▼
                                              Adjudicator → calibrated verdict
                                                          ▼
                                       reveal ground truth → Weave eval (accuracy/FPR/Brier)
```

- **The secret and the mode never enter a detector or adjudicator prompt** — they see only the public transcript + signals. This invariant is enforced at the `render_transcript` boundary and guarded by a test.
- **Weave traces every round** (`@weave.op` on the speaker, each detector, the adjudicator, the orchestrator) and runs the evaluation that produces the money metrics.
- A custom async orchestrator runs the panel concurrently and emits `RoundEvent`s that stream to the UI over AG-UI (SSE) or a WebSocket fallback.

---

## Quickstart

**Prereqs:** Python 3.11, Node 20+, Docker (for Redis Stack), [`uv`](https://docs.astral.sh/uv/).

```bash
cp .env.example .env        # fill WANDB_API_KEY, OPENAI_API_KEY, OPENAI_MODEL
make install                # venv + backend deps + frontend deps
make redis                  # Redis Stack (6379; RedisInsight on 8001)
wandb login                 # paste your W&B key

make test                   # deterministic unit tests (free, no keys)
make api                    # FastAPI backend on :8000
make web                    # Next.js courtroom on :3000
make eval                   # the Weave evaluation (accuracy/FPR/Brier; needs keys)
```

**See it run:**
- **Terminal demo:** `cd backend && ../.venv/bin/python -m scripts.demo` (add `--redis` for on-brand RedisVL).
- **Courtroom UI:** `make api` + `make web`, open http://localhost:3000, click **Run a round** — meters move live, the verdict fires.

`make check` is the green gate (lint + typecheck + fast tests + frontend build) — run before every commit. Test strategy + tiers: [`docs/TESTING.md`](docs/TESTING.md).

---

## Sponsor usage

| Sponsor | How Tell uses it |
|---|---|
| **Weave (W&B)** | Round/agent/tool tracing via `@weave.op`; `weave.Evaluation` over a 4-mode dataset for **accuracy, false-positive rate, calibration (Brier)**, and the **panel-vs-single** comparison. The core scoreboard. |
| **Redis** | Three load-bearing capabilities: **pub/sub** fan-out of utterances/signals (live meters), **RedisVL vector search** for the Consistency Auditor's contradiction-finding, and **sorted sets** for the detector leaderboard. |
| **CopilotKit / AG-UI** | The courtroom streams as AG-UI events (STATE_DELTA meters, TEXT_MESSAGE transcript, CUSTOM verdict) over SSE, with a WebSocket fallback. |
| **OpenAI** | Speaker, detectors, and adjudicator via structured outputs (`chat.completions.parse`); embeddings for RedisVL; web search via the Responses API. |
| **Cursor** | Built with Cursor; wire the W&B MCP server in to inspect traces while building. |

---

## Responsible scope

Tell is a **detection / evaluation** tool, not a manipulation engine. The speaker is sandboxed and assigned its role by us, which is what makes the ground truth objective. The secret and mode are confined to the speaker and never reach the detectors or adjudicator. We report and surface the **false-positive rate** because a detector that cries wolf is worse than none — and we're honest in Q&A about where it fails.

---

## Layout

```
backend/app/      models · config · llm · speaker · detectors/ · adjudicator · orchestrator · bus · memory · agui · main
backend/eval/     dataset · scorers · run_eval        backend/tests/   deterministic + agent tiers
frontend/app/     courtroom UI (meters · transcript · progress · verdict) over the WS transport
docs/             SPEC · IMPLEMENTATION_PLAN · TESTING · AUTOMATION · PR_STATUS
.claude/skills/   weave · openai · redis · copilotkit-agui  (read before using a tech)
```

## Submission checklist (SPEC §17)

- [ ] Public repo with run instructions (this README)
- [ ] **W&B Weave project link** included
- [ ] Submitted on the Cerebral Valley platform (confirm DevPost) by **12:50 Sun**
- [ ] **<2-min demo video** — open on the meter spike at the lie
- [ ] Every sponsor tool + how (table above)
- [ ] Team + socials
