# SKILL: Weights & Biases Weave (tracing + evals)

**When to use:** any time you add tracing, run an eval, or touch W&B in this repo. Read before writing Weave code.

## Setup
```bash
pip install weave wandb openai
wandb login           # paste key from https://wandb.ai/authorize
```
Env: `WANDB_API_KEY` (also used as the bearer token for the W&B MCP server). At the event, fill the credits form for $50 W&B Inference credits.

## The two things Weave does
1. **Tracing** — see every LLM/agent/tool call as a span tree.
2. **Evaluations** — run your system over a dataset and score it.

## Tracing (do this everywhere)
```python
import weave
weave.init("tell")          # call ONCE at process start, before any traced call

@weave.op                    # works on sync AND async functions
async def cross_examine(transcript: list[dict]) -> dict:
    ...
```
**Weave auto-patches the OpenAI SDK** — if you call `OpenAI()` / `AsyncOpenAI()` after `weave.init`, those calls are traced automatically with no extra code. Wrap your own functions in `@weave.op` so the span tree shows orchestration (round → speaker → each detector → adjudicator).

Need the result *and* the call handle (for online scoring / linking)?
```python
result, call = await cross_examine.call(transcript)
```

## Evaluations (the money metric for this project)
A scorer is a `@weave.op` that returns a **dict**. It receives `output` (your system's result) plus any keys from the dataset row (e.g. `speaker_mode`).
```python
import weave

@weave.op
def verdict_correct(speaker_mode: str, output: dict) -> dict:
    truth = "honest" if speaker_mode == "honest" else "deceptive"
    return {"correct": output["label"] == truth}

@weave.op
def brier(speaker_mode: str, output: dict) -> dict:
    truth_is_deceptive = 0.0 if speaker_mode == "honest" else 1.0
    p = output["confidence"] if output["label"] == "deceptive" else 1 - output["confidence"]
    return {"brier": (p - truth_is_deceptive) ** 2}

class TellPanel(weave.Model):          # or just pass a @weave.op
    @weave.op
    async def predict(self, topic: str, speaker_mode: str, secret: str) -> dict:
        return await run_round(topic, speaker_mode, secret)   # -> {"label":..., "confidence":...}

dataset = [{"topic": "...", "speaker_mode": "lying", "secret": "..."}, ...]
ev = weave.Evaluation(dataset=dataset, scorers=[verdict_correct, brier])
await ev.evaluate(TellPanel())          # results show in the Weave UI
```
- **Panel-vs-single-detector chart:** run two `weave.Evaluation`s (one model = full panel, one = a single detector) on the *same* dataset; compare in the Weave UI.
- **Calibration:** the `brier` scorer above; lower is better-calibrated.
- **False-positive rate:** add a scorer that fires only on `speaker_mode == "honest"` rows.

## Optional: predefined scorers
`from weave.scorers import ...` includes a hallucination scorer (HHEM) and a trust scorer — handy as an extra signal for the Evidence Checker. Don't block the core path on these.

## Optional: W&B Inference instead of OpenAI (uses your $50 credits, extra on-brand)
W&B Inference is OpenAI-compatible. Point the client at it:
```python
client = OpenAI(base_url="https://api.inference.wandb.ai/v1", api_key=os.environ["WANDB_API_KEY"])
# confirm exact base_url at wandb.me/inference during the event
```

## Gotchas
- `weave.init` **must** run before the first traced/OpenAI call.
- Async ops are fine; the orchestrator should be async.
- Never put the speaker's secret into a detector prompt — that defeats the experiment (and would leak into traces).
- Confirm the `Evaluation` API surface against https://weave-docs.wandb.ai if anything errors; `weave.init` + `@weave.op` are stable.
