"""PR8: behavioral analyst plumbing (Tier 1; bounds belong to Tier-2 fixtures)."""

from unittest import mock

import pytest
from app import llm
from app.detectors.base import Assessment
from app.detectors.behavioral import NAME, BehavioralAnalyst
from app.models import Role, Utterance


async def test_emits_named_signal(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        llm,
        "structured_call",
        mock.AsyncMock(return_value=Assessment(suspicion=0.7, rationale="hedging", evidence="s1")),
    )
    sig = await BehavioralAnalyst().assess(
        "t", [Utterance(id="s1", role=Role.SPEAKER, text="um, I think, maybe")]
    )
    assert sig.detector == NAME
    assert sig.suspicion == 0.7
    assert sig.utterance_ref == "s1"


async def test_sees_public_text(monkeypatch: pytest.MonkeyPatch) -> None:
    spy = mock.AsyncMock(return_value=Assessment(suspicion=0.3, rationale="direct"))
    monkeypatch.setattr(llm, "structured_call", spy)
    await BehavioralAnalyst().assess(
        "topic", [Utterance(id="s1", role=Role.SPEAKER, text="hello there")]
    )
    blob = " ".join(m["content"] for m in spy.await_args.args[0])
    assert "hello there" in blob
