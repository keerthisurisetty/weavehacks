"""APR1: detector k-sampling aggregation is deterministic + correct (Tier 1).

Mocks the one network boundary (llm.structured_call) so the aggregation logic is
tested without a model. The live effect on variance is a Tier-3 concern (make eval).
"""

from typing import Any

import pytest
from app import llm
from app.config import settings
from app.detectors.base import Assessment, sampled_assessment


def _assessments(*suspicions: float) -> list[Assessment]:
    return [Assessment(suspicion=s, rationale=f"r{s}", evidence=None) for s in suspicions]


def _patch_calls(
    monkeypatch: pytest.MonkeyPatch, results: list[Assessment]
) -> list[dict[str, Any]]:
    """Replace llm.structured_call with a fake that yields ``results`` in order."""
    calls: list[dict[str, Any]] = []
    it = iter(results)

    async def fake(
        messages: list[dict[str, str]],
        schema: type,
        *,
        model: str | None = None,
        temperature: float = 0.2,
    ) -> Assessment:
        calls.append({"model": model, "temperature": temperature})
        return next(it)

    monkeypatch.setattr(llm, "structured_call", fake)
    return calls


async def test_median_suspicion_and_representative_rationale(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_calls(monkeypatch, _assessments(0.2, 0.8, 0.5))
    a = await sampled_assessment([{"role": "user", "content": "x"}], k=3)
    assert a.suspicion == 0.5  # median of [0.2, 0.5, 0.8]
    assert a.rationale == "r0.5"  # rationale of the sample closest to the median


async def test_median_is_robust_to_an_outlier(monkeypatch: pytest.MonkeyPatch) -> None:
    # two agree at 0.9, one outlier at 0.1 -> median ignores the outlier
    _patch_calls(monkeypatch, _assessments(0.9, 0.1, 0.9))
    a = await sampled_assessment([{"role": "user", "content": "x"}], k=3)
    assert a.suspicion == 0.9


async def test_k1_is_a_single_call(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _patch_calls(monkeypatch, _assessments(0.7))
    a = await sampled_assessment([{"role": "user", "content": "x"}], k=1)
    assert a.suspicion == 0.7
    assert len(calls) == 1


async def test_uses_detector_model_and_temperature(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _patch_calls(monkeypatch, _assessments(0.3, 0.3, 0.3))
    monkeypatch.setattr(settings, "openai_detector_model", "mini-x")
    await sampled_assessment([{"role": "user", "content": "x"}], k=3, temperature=0.0)
    assert [c["model"] for c in calls] == ["mini-x", "mini-x", "mini-x"]
    assert all(c["temperature"] == 0.0 for c in calls)


async def test_default_k_comes_from_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "detector_samples", 2)
    calls = _patch_calls(monkeypatch, _assessments(0.4, 0.6))
    a = await sampled_assessment([{"role": "user", "content": "x"}])  # no k -> settings
    assert len(calls) == 2
    assert a.suspicion == 0.5  # median of [0.4, 0.6]


def test_detector_model_falls_back_to_speaker(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_detector_model", None)
    monkeypatch.setattr(settings, "openai_model", "speaker-x")
    assert llm.detector_model() == "speaker-x"


def test_detector_model_uses_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_detector_model", "mini-x")
    assert llm.detector_model() == "mini-x"
