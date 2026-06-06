# SKILL: CopilotKit + AG-UI (the courtroom frontend)

**When to use:** building the live UI — suspicion meters, transcript, verdict, and the human-asks-a-question (HITL) box. This is the **highest-integration-risk** part of the project; time-box it and keep the fallback ready.

## Mental model
- **AG-UI** (Agent–User Interaction Protocol, by CopilotKit) is an open, event-based protocol: your backend streams a sequence of JSON events (over HTTP/SSE) and the frontend renders them; the frontend can also send events back (→ human-in-the-loop). Event kinds: lifecycle (RUN_STARTED/FINISHED), text messages, tool calls, **state snapshots/deltas** (shared state), and **custom events**.
- **CopilotKit** is the React layer that consumes AG-UI and gives you chat components, generative UI, shared-state hooks, and HITL.
- **Live meters = shared state.** The backend keeps a state object like `{"suspicion": {"consistency": 0.78, ...}, "verdict": null}` and emits STATE_DELTA patches as scores change; the React UI reads that state and re-renders the meters. The verdict/reveal can be a STATE_DELTA or a CUSTOM event.

## Backend (Python, custom orchestrator)
```bash
pip install ag-ui-protocol starlette   # FastAPI already present
```
Expose an SSE endpoint that runs a round and yields encoded AG-UI events:
```python
from ag_ui.core import (RunStartedEvent, RunFinishedEvent, StateSnapshotEvent,
                        StateDeltaEvent, CustomEvent, TextMessageStartEvent, TextMessageContentEvent)
from ag_ui.encoder import EventEncoder
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()
enc = EventEncoder()

@app.post("/agui")            # CopilotKit points here
async def agui(req: Request):
    async def stream():
        yield enc.encode(RunStartedEvent(...))
        yield enc.encode(StateSnapshotEvent(snapshot={"suspicion": {}, "transcript": [], "verdict": None}))
        async for ev in run_round_streaming(...):     # your orchestrator yields updates
            if ev.kind == "utterance":
                yield enc.encode(TextMessageContentEvent(...))            # transcript
            elif ev.kind == "signal":
                yield enc.encode(StateDeltaEvent(delta=[{"op":"replace",
                    "path": f"/suspicion/{ev.detector}", "value": ev.suspicion}]))  # meters (JSON-Patch)
            elif ev.kind == "verdict":
                yield enc.encode(CustomEvent(name="verdict", value=ev.payload))
        yield enc.encode(RunFinishedEvent(...))
    return StreamingResponse(stream(), media_type="text/event-stream")
```
> Exact class/arg names: confirm against the AG-UI docs (https://docs.ag-ui.com) and the `ag-ui-protocol` package — names are stable in spirit (RunStarted/StateDelta/Custom) but verify signatures. The bridge from your Redis `round:{id}:signal` channel into this stream is just: subscribe to the channel and translate each signal into a STATE_DELTA.

## Frontend (Next.js + React)
```bash
npx create-next-app@latest frontend
npm i @copilotkit/react-core @copilotkit/react-ui
```
```tsx
import { CopilotKit } from "@copilotkit/react-core";
// wrap the app, pointing at your AG-UI backend
<CopilotKit runtimeUrl="/api/copilotkit" agent="tell">
  <Courtroom />
</CopilotKit>
```
- Read shared state (the meters) with the agent/shared-state hook (e.g. `useCoAgent` / `useAgent` — confirm the current hook name in docs; CopilotKit ships React AG-UI clients) and render a bar per detector.
- **Generative UI:** render the verdict card from the `verdict` custom event / state.
- **HITL:** a text box that sends a user message back through AG-UI so the human can ask the speaker a follow-up; the orchestrator treats it as another cross-exam turn.

## Pragmatic paths (pick based on time)
1. **Direct AG-UI events** (above) — most control, fits the custom orchestrator. Default.
2. **First-party adapter** — if you'd rather not hand-roll events, CopilotKit has first-party integrations (PydanticAI, LangGraph, ADK, etc.); you could express the panel as a PydanticAI agent and get AG-UI "for free." Bigger framework commitment.

## FALLBACK (decide by a hard time-box, e.g. Sun 11:00)
If AG-UI wiring isn't working, ship a plain **FastAPI WebSocket → React** UI: backend forwards `round:{id}:signal` messages over a WebSocket; React renders the same meters. You keep the full demo and lose only the CopilotKit sponsor prize. Do **not** let the UI integration sink the core demo.

## Gotchas
- CopilotKit moves fast (raised a $27M Series A in May 2026) — verify hook/package names against current docs before deep work.
- Build the backend event stream against the AG-UI "Dojo"/example first to confirm the wire format, *then* connect the real orchestrator.
- State deltas use JSON-Patch ops (`replace`/`add` at a `path`); keep your state shape flat and simple (`/suspicion/<detector>`).
