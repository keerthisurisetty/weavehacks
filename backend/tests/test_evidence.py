"""PR8/PR14: evidence checker — abstains when it can't check, else judges vs evidence."""

from unittest import mock

import pytest
from app import llm
from app.detectors.base import Assessment
from app.detectors.evidence_checker import NAME, EvidenceChecker
from app.models import Role, Utterance


async def test_no_claim_yet() -> None:
    sig = await EvidenceChecker().assess("t", [])
    assert sig.detector == NAME and sig.suspicion == 0.0
    assert sig.abstained is True


async def test_abstains_when_no_evidence(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "gather_evidence", mock.AsyncMock(return_value=""))
    sig = await EvidenceChecker().assess(
        "astronomy", [Utterance(id="s1", role=Role.SPEAKER, text="the moon is cheese")]
    )
    assert sig.abstained is True  # can't check -> doesn't vote
    assert "no external evidence" in sig.rationale


async def test_judges_claim_against_evidence(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        llm, "gather_evidence", mock.AsyncMock(return_value="The Moon is rock, not cheese.")
    )
    monkeypatch.setattr(
        llm,
        "structured_call",
        mock.AsyncMock(
            return_value=Assessment(
                suspicion=0.95, rationale="contradicted by evidence", evidence="s1"
            )
        ),
    )
    sig = await EvidenceChecker().assess(
        "astronomy", [Utterance(id="s1", role=Role.SPEAKER, text="the moon is cheese")]
    )
    assert sig.suspicion == 0.95 and sig.utterance_ref == "s1"
    assert sig.abstained is False  # has evidence -> votes
