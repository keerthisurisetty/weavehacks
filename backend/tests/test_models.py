"""PR1: domain-model validation (Tier 1 — deterministic, free)."""

import pytest
from app.models import (
    DetectorSignal,
    EvalResult,
    Mode,
    Phase,
    Role,
    Round,
    RoundProgress,
    SpeakerConfig,
    Utterance,
    Verdict,
)
from pydantic import ValidationError


def test_mode_has_four_values() -> None:
    assert {m.value for m in Mode} == {
        "honest",
        "lying",
        "strategic_deception",
        "hallucinating",
    }


def test_mode_ground_truth_mapping() -> None:
    assert Mode.HONEST.ground_truth == "honest"
    for m in (Mode.LYING, Mode.STRATEGIC_DECEPTION, Mode.HALLUCINATING):
        assert m.ground_truth == "deceptive"


def test_construct_each_model() -> None:
    Utterance(id="u_01", role=Role.SPEAKER, text="hello")
    DetectorSignal(detector="consistency_auditor", suspicion=0.78, rationale="x")
    Verdict(label="deceptive", confidence=0.87, decisive_detector="consistency_auditor")
    SpeakerConfig(topic="expenses", mode=Mode.LYING, secret="it was personal")
    RoundProgress(phase=Phase.INTERROGATION, progress=42)
    EvalResult(n_rounds=40, accuracy=0.9, false_positive_rate=0.07, brier_score=0.11)


@pytest.mark.parametrize("bad", [-0.01, 1.01, 2.0])
def test_confidence_must_be_a_probability(bad: float) -> None:
    with pytest.raises(ValidationError):
        Verdict(label="honest", confidence=bad)


@pytest.mark.parametrize("bad", [-0.5, 1.5])
def test_suspicion_must_be_a_probability(bad: float) -> None:
    with pytest.raises(ValidationError):
        DetectorSignal(detector="behavioral", suspicion=bad)


@pytest.mark.parametrize("bad", [-1, 101])
def test_progress_bounded_0_100(bad: int) -> None:
    with pytest.raises(ValidationError):
        RoundProgress(phase=Phase.SETUP, progress=bad)


def test_round_from_config_stamps_ground_truth() -> None:
    cfg = SpeakerConfig(topic="t", mode=Mode.STRATEGIC_DECEPTION, secret="s")
    rnd = Round.from_config("r_001", cfg)
    assert rnd.ground_truth == "deceptive"
    assert rnd.speaker_mode is Mode.STRATEGIC_DECEPTION
    assert rnd.verdict is None and rnd.correct is None


def test_round_score_compares_verdict_to_truth() -> None:
    cfg = SpeakerConfig(topic="t", mode=Mode.HONEST, secret="s")
    rnd = Round.from_config("r_002", cfg)
    assert rnd.score() is False  # no verdict yet -> correct stays falsy/None
    assert rnd.correct is None

    rnd.verdict = Verdict(label="honest", confidence=0.8)
    assert rnd.score() is True
    assert rnd.correct is True

    rnd.verdict = Verdict(label="deceptive", confidence=0.9)
    assert rnd.score() is False
    assert rnd.correct is False
