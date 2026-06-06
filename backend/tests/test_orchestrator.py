"""PR4: orchestrator lifecycle with a mocked LLM (Tier 1, deterministic).

One fake routes by schema so speaker + cross-examiner are canned; the adjudicator
runs for real (rule-based). This deterministically covers most of the system.
"""

from collections.abc import Callable

import pytest
from app import llm
from app.detectors.base import Assessment
from app.detectors.cross_examiner import FollowUp
from app.models import Mode, SpeakerConfig
from app.orchestrator import run_round
from app.speaker import SpeakerReply


def _fake_llm(suspicion: float) -> tuple[Callable, list[tuple]]:
    calls: list[tuple] = []

    async def fake(messages, schema, **kwargs):  # noqa: ANN001, ANN003
        calls.append((schema, messages))
        if schema is SpeakerReply:
            return SpeakerReply(answer="It was a client dinner, I'm completely certain.")
        if schema is FollowUp:
            return FollowUp(question="Who exactly attended, and who paid?")
        if schema is Assessment:
            return Assessment(
                suspicion=suspicion, rationale="evasive, shifting story", evidence="s1"
            )
        raise AssertionError(f"unexpected schema {schema!r}")

    return fake, calls


async def test_deceptive_round_lifecycle(monkeypatch: pytest.MonkeyPatch) -> None:
    fake, _ = _fake_llm(0.9)
    monkeypatch.setattr(llm, "structured_call", fake)
    events = []

    async def emit(e):  # noqa: ANN001, ANN202
        events.append(e)

    cfg = SpeakerConfig(topic="an expense report", mode=Mode.LYING, secret="dinner was personal")
    rnd = await run_round(cfg, max_turns=4, emit=emit, rid="r_test")

    assert rnd.verdict is not None
    assert rnd.verdict.label == "deceptive"
    assert rnd.ground_truth == "deceptive"
    assert rnd.correct is True

    # progress is emitted, monotonic, and reaches 100
    progresses = [e.progress for e in events if e.kind == "progress"]
    assert progresses == sorted(progresses)
    assert progresses[-1] == 100

    # exactly one verdict event, at the end
    assert sum(1 for e in events if e.kind == "verdict") == 1
    assert events[-1].kind == "verdict"

    # high suspicion -> short-circuit after the first turn -> a single signal
    assert len(rnd.signals) == 1


async def test_honest_round_is_scored_correct(monkeypatch: pytest.MonkeyPatch) -> None:
    fake, _ = _fake_llm(0.1)
    monkeypatch.setattr(llm, "structured_call", fake)

    cfg = SpeakerConfig(topic="t", mode=Mode.HONEST, secret="x")
    rnd = await run_round(cfg, max_turns=3)

    assert rnd.verdict is not None
    assert rnd.verdict.label == "honest"
    assert rnd.correct is True


async def test_uncertain_signal_runs_all_turns(monkeypatch: pytest.MonkeyPatch) -> None:
    # confidence 0.5 < short-circuit threshold -> no early call -> full loop
    fake, _ = _fake_llm(0.5)
    monkeypatch.setattr(llm, "structured_call", fake)

    cfg = SpeakerConfig(topic="t", mode=Mode.LYING, secret="x")
    rnd = await run_round(cfg, max_turns=3)

    assert len(rnd.signals) == 3  # one per turn, no short-circuit


async def test_secret_never_reaches_detector_prompts(monkeypatch: pytest.MonkeyPatch) -> None:
    fake, calls = _fake_llm(0.7)
    monkeypatch.setattr(llm, "structured_call", fake)
    secret = "SUPER-SECRET-VALUE-42"

    cfg = SpeakerConfig(topic="t", mode=Mode.LYING, secret=secret)
    await run_round(cfg, max_turns=3)

    for schema, messages in calls:
        blob = " ".join(m["content"] for m in messages)
        if schema in (FollowUp, Assessment):  # detector-bound calls
            assert secret not in blob, f"secret leaked into {schema.__name__} prompt"
