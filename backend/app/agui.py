"""AG-UI streaming endpoint (+ WebSocket fallback) — the courtroom's backend.

Bridges the orchestrator's RoundEvents to AG-UI: suspicion + progress as
JSON-Patch STATE_DELTAs, transcript as TEXT_MESSAGE events, the verdict as a
CUSTOM event (and a state delta). The stream NEVER carries the secret or the
mode — only transcript text, suspicion, progress, and the verdict.

Highest-integration-risk piece, so it ships with a fallback: /ws/round forwards
the same RoundEvents as plain JSON, and the UI can consume either.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import suppress
from typing import Any, cast

from ag_ui.core import (
    CustomEvent,
    RunFinishedEvent,
    RunStartedEvent,
    StateDeltaEvent,
    StateSnapshotEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
)
from ag_ui.encoder import EventEncoder
from fastapi import APIRouter, Request, WebSocket
from fastapi.responses import StreamingResponse

from app import orchestrator
from app.events import RoundEvent
from app.models import Mode, Role, SpeakerConfig

router = APIRouter()

# The shared-state shape the frontend renders (meters + progress + verdict).
INITIAL_STATE: dict[str, Any] = {"suspicion": {}, "phase": "setup", "progress": 0, "verdict": None}

_DEMO_CFG = SpeakerConfig(
    topic="an expense report for a client trip",
    mode=Mode.LYING,
    secret="the $400 dinner was personal, not for a client",
)


def round_event_to_agui(event: RoundEvent) -> list[Any]:
    """Map one orchestrator RoundEvent to AG-UI events (no secret/mode ever)."""
    if event.kind == "utterance" and event.utterance is not None:
        u = event.utterance
        role = "assistant" if u.role is Role.SPEAKER else "user"
        return [
            TextMessageStartEvent(message_id=u.id, role=cast(Any, role)),
            TextMessageContentEvent(message_id=u.id, delta=u.text),
            TextMessageEndEvent(message_id=u.id),
        ]
    if event.kind == "signal" and event.signal is not None:
        s = event.signal
        return [
            StateDeltaEvent(
                delta=[{"op": "add", "path": f"/suspicion/{s.detector}", "value": s.suspicion}]
            )
        ]
    if event.kind == "progress" and event.phase is not None:
        return [
            StateDeltaEvent(
                delta=[
                    {"op": "replace", "path": "/phase", "value": str(event.phase)},
                    {"op": "replace", "path": "/progress", "value": event.progress or 0},
                ]
            )
        ]
    if event.kind == "verdict" and event.verdict is not None:
        v = event.verdict.model_dump()
        return [
            StateDeltaEvent(delta=[{"op": "replace", "path": "/verdict", "value": v}]),
            CustomEvent(name="verdict", value=v),
        ]
    return []


def _cfg_from_body(body: dict[str, Any]) -> SpeakerConfig:
    """Round config comes from the (operator) request; defaults to a demo round.

    The viewer UI never sends or sees secret/mode — this is the operator seam.
    """
    if all(k in body for k in ("topic", "mode", "secret")):
        return SpeakerConfig(topic=body["topic"], mode=Mode(body["mode"]), secret=body["secret"])
    return _DEMO_CFG


async def _drive(cfg: SpeakerConfig, rid: str) -> AsyncIterator[RoundEvent]:
    """Run a round in a task, yielding its RoundEvents (push sink -> pull stream)."""
    queue: asyncio.Queue[RoundEvent | None] = asyncio.Queue()

    async def sink(ev: RoundEvent) -> None:
        await queue.put(ev)

    async def runner() -> None:
        try:
            await orchestrator.run_round(cfg, emit=sink, rid=rid)
        finally:
            await queue.put(None)  # sentinel

    task = asyncio.create_task(runner())
    try:
        while True:
            ev = await queue.get()
            if ev is None:
                break
            yield ev
    finally:
        if not task.done():
            task.cancel()
        with suppress(asyncio.CancelledError, Exception):
            await task


async def stream_round(cfg: SpeakerConfig, rid: str) -> AsyncIterator[str]:
    enc = EventEncoder()
    yield enc.encode(RunStartedEvent(thread_id=rid, run_id=rid))
    yield enc.encode(StateSnapshotEvent(snapshot=dict(INITIAL_STATE)))
    async for ev in _drive(cfg, rid):
        for agui_ev in round_event_to_agui(ev):
            yield enc.encode(agui_ev)
    yield enc.encode(RunFinishedEvent(thread_id=rid, run_id=rid))


@router.post("/agui")
async def agui_endpoint(req: Request) -> StreamingResponse:
    raw = await req.body()
    body = await req.json() if raw else {}
    rid = body.get("rid", "r_agui")
    return StreamingResponse(
        stream_round(_cfg_from_body(body), rid), media_type="text/event-stream"
    )


@router.websocket("/ws/round")
async def ws_round(ws: WebSocket) -> None:
    """Fallback transport: forward the same RoundEvents as plain JSON."""
    await ws.accept()

    async def sink(ev: RoundEvent) -> None:
        await ws.send_json(ev.model_dump(mode="json"))

    try:
        await orchestrator.run_round(_DEMO_CFG, emit=sink, rid="r_ws")
    finally:
        with suppress(Exception):
            await ws.close()
