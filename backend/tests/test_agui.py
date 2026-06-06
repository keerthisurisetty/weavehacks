"""PR10: AG-UI event-sequence shape + WS fallback against a mocked round (Tier 1).

run_round is monkeypatched to emit a scripted RoundEvent sequence, so this is
deterministic and needs no model. Also guards: the stream never carries the secret.
"""

import pytest
from app import orchestrator
from app.agui import round_event_to_agui
from app.events import RoundEvent
from app.main import app
from app.models import DetectorSignal, Phase, Role, Round, Utterance, Verdict
from fastapi.testclient import TestClient

SECRET = "TOP-SECRET-XYZ"


async def _fake_run_round(cfg, *, emit, rid="r", **kwargs):
    await emit(RoundEvent(kind="progress", phase=Phase.SETUP, progress=5))
    await emit(
        RoundEvent(
            kind="utterance",
            utterance=Utterance(id="s1", role=Role.SPEAKER, text="it was a client dinner"),
        )
    )
    await emit(
        RoundEvent(kind="signal", signal=DetectorSignal(detector="cross_examiner", suspicion=0.82))
    )
    await emit(RoundEvent(kind="progress", phase=Phase.INTERROGATION, progress=40))
    await emit(
        RoundEvent(
            kind="verdict",
            verdict=Verdict(label="deceptive", confidence=0.82, decisive_detector="cross_examiner"),
        )
    )
    return Round.from_config(rid, cfg)


def test_signal_maps_to_suspicion_state_delta() -> None:
    evs = round_event_to_agui(
        RoundEvent(
            kind="signal", signal=DetectorSignal(detector="behavioral_analyst", suspicion=0.7)
        )
    )
    assert len(evs) == 1
    delta = evs[0].delta[0]
    assert delta["path"] == "/suspicion/behavioral_analyst" and delta["value"] == 0.7


def test_utterance_maps_to_text_message_triplet() -> None:
    evs = round_event_to_agui(
        RoundEvent(kind="utterance", utterance=Utterance(id="s1", role=Role.SPEAKER, text="hi"))
    )
    assert len(evs) == 3  # start, content, end


def test_sse_stream_sequence_and_no_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(orchestrator, "run_round", _fake_run_round)
    client = TestClient(app)

    resp = client.post("/agui", json={"topic": "t", "mode": "lying", "secret": SECRET, "rid": "r1"})
    assert resp.status_code == 200
    body = resp.text

    # lifecycle + the right event kinds in the stream
    assert "RUN_STARTED" in body
    assert "STATE_SNAPSHOT" in body
    assert "STATE_DELTA" in body
    assert "TEXT_MESSAGE_START" in body
    assert "CUSTOM" in body
    assert "RUN_FINISHED" in body
    # content streamed
    assert "it was a client dinner" in body  # transcript
    assert "cross_examiner" in body  # suspicion meter
    assert "deceptive" in body  # verdict
    # the invariant: the secret never reaches the wire
    assert SECRET not in body


def test_ws_fallback_forwards_events(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(orchestrator, "run_round", _fake_run_round)
    client = TestClient(app)

    msgs = []
    with client.websocket_connect("/ws/round") as ws:
        with pytest.raises(Exception):  # noqa: B017 - drains until the server closes
            while True:
                msgs.append(ws.receive_json())

    kinds = [m["kind"] for m in msgs]
    assert "utterance" in kinds and "signal" in kinds and "verdict" in kinds
    assert SECRET not in " ".join(str(m) for m in msgs)
