"""PR8: orchestrator drives the panel concurrently, fuses latest-per-detector.

Lifecycle / short-circuit / panel-vs-single use injected stub detectors
(deterministic, no model). One default-panel test guards the secret-leak invariant
against the real detectors.
"""

import pytest
from app import llm
from app.detectors.base import Assessment
from app.detectors.cross_examiner import FollowUp
from app.models import DetectorSignal, Mode, SpeakerConfig, Utterance
from app.orchestrator import run_round
from app.speaker import SpeakerReply


class _Stub:
    """A detector that always reports a fixed suspicion."""

    def __init__(self, name: str, suspicion: float) -> None:
        self.name = name
        self._s = suspicion

    async def assess(self, topic: str, transcript: list[Utterance]) -> DetectorSignal:
        ref = transcript[-1].id if transcript else None
        return DetectorSignal(detector=self.name, suspicion=self._s, utterance_ref=ref)


def _mock_dialogue(monkeypatch: pytest.MonkeyPatch) -> None:
    """Mock only the question + speaker calls; detectors are stubs."""

    async def fake(messages, schema, **kwargs):
        if schema is SpeakerReply:
            return SpeakerReply(answer="It was a client dinner, I'm certain.")
        if schema is FollowUp:
            return FollowUp(question="Who attended, and who paid?")
        raise AssertionError(f"unexpected schema {schema!r}")

    monkeypatch.setattr(llm, "structured_call", fake)


async def test_panel_lifecycle_and_short_circuit(monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_dialogue(monkeypatch)
    events = []

    async def emit(e):
        events.append(e)

    cfg = SpeakerConfig(topic="expenses", mode=Mode.LYING, secret="x")
    rnd = await run_round(
        cfg, detectors=[_Stub("a", 0.9), _Stub("b", 0.95)], emit=emit, max_turns=4
    )

    assert rnd.verdict is not None and rnd.verdict.label == "deceptive"
    assert rnd.correct is True
    assert len(rnd.signals) == 2  # two detectors, one (short-circuited) turn
    progresses = [e.progress for e in events if e.kind == "progress"]
    assert progresses == sorted(progresses) and progresses[-1] == 100
    assert events[-1].kind == "verdict"


async def test_uncertain_runs_all_turns(monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_dialogue(monkeypatch)
    rnd = await run_round(
        SpeakerConfig(topic="t", mode=Mode.LYING, secret="x"),
        detectors=[_Stub("a", 0.5)],
        max_turns=3,
    )
    assert len(rnd.signals) == 3  # one detector x three turns, no short-circuit


async def test_panel_beats_single_on_disagreement(monkeypatch: pytest.MonkeyPatch) -> None:
    _mock_dialogue(monkeypatch)
    cfg = SpeakerConfig(topic="t", mode=Mode.LYING, secret="x")  # ground truth: deceptive

    panel = await run_round(
        cfg,
        detectors=[_Stub("dove", 0.2), _Stub("hawk1", 0.9), _Stub("hawk2", 0.9)],
        max_turns=2,
        rid="rp",
    )
    single = await run_round(cfg, detectors=[_Stub("dove", 0.2)], max_turns=2, rid="rs")

    assert (
        panel.verdict is not None and panel.verdict.label == "deceptive" and panel.correct is True
    )
    assert (
        single.verdict is not None and single.verdict.label == "honest" and single.correct is False
    )


async def test_secret_never_reaches_detectors_default_panel(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    secret = "SUPER-SECRET-7"
    calls: list[tuple] = []

    async def fake_sc(messages, schema, **kwargs):
        calls.append((schema, messages))
        if schema is SpeakerReply:
            return SpeakerReply(answer="a confident, specific answer")
        if schema is FollowUp:
            return FollowUp(question="why is that?")
        if schema is Assessment:
            return Assessment(suspicion=0.9, rationale="evasive", evidence="s1")
        raise AssertionError(schema)

    async def fake_embed(text, **kw):
        return [0.1, 0.2, 0.3]

    monkeypatch.setattr(llm, "structured_call", fake_sc)
    monkeypatch.setattr(llm, "embed_text", fake_embed)

    cfg = SpeakerConfig(topic="t", mode=Mode.LYING, secret=secret)
    await run_round(cfg, max_turns=2)  # default panel (cross-examiner + consistency + behavioral)

    for schema, messages in calls:
        if schema in (FollowUp, Assessment):  # detector-bound calls
            blob = " ".join(m["content"] for m in messages)
            assert secret not in blob, f"secret leaked into {schema.__name__} prompt"
