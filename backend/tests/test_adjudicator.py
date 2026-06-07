"""PR4: rule-based adjudicator fusion is deterministic (Tier 1)."""

from app.adjudicator import Adjudicator
from app.models import DetectorSignal


def _sig(name: str, s: float) -> DetectorSignal:
    return DetectorSignal(detector=name, suspicion=s)


def test_deceptive_above_threshold() -> None:
    # noisy-OR: 1 - (1-0.6)*(1-0.4) = 0.76
    v = Adjudicator().fuse([_sig("a", 0.8), _sig("b", 0.7)])
    assert v.label == "deceptive"
    assert abs(v.confidence - 0.76) < 1e-9


def test_honest_below_threshold() -> None:
    # below-neutral suspicion contributes no deception evidence -> raw 0
    v = Adjudicator().fuse([_sig("a", 0.2)])
    assert v.label == "honest"
    assert v.confidence == 1.0  # 1 - raw(0)


def test_decisive_detector_is_most_extreme() -> None:
    v = Adjudicator().fuse([_sig("mild", 0.55), _sig("strong", 0.95)])
    assert v.decisive_detector == "strong"


def test_no_signals_defaults_to_uncertain_honest() -> None:
    v = Adjudicator().fuse([])
    assert v.label == "honest"
    assert v.confidence == 0.5


def test_contributing_signals_listed() -> None:
    v = Adjudicator().fuse([_sig("x", 0.9)])
    assert v.contributing_signals == ["x:0.90"]


def test_weighted_fusion_favors_reliable_detector() -> None:
    # evidence_checker fires (0.9); behavioral_analyst is calm (0.2) and cannot
    # dilute the catch under noisy-OR -> deceptive on the evidence alone.
    v = Adjudicator().fuse([_sig("evidence_checker", 0.9), _sig("behavioral_analyst", 0.2)])
    assert v.label == "deceptive"


def test_decisive_detector_accounts_for_weight() -> None:
    # behavioral 0.8*|0.45|=0.36 < evidence 1.3*|0.30|=0.39 -> evidence is decisive
    v = Adjudicator().fuse([_sig("behavioral_analyst", 0.95), _sig("evidence_checker", 0.8)])
    assert v.decisive_detector == "evidence_checker"


def test_abstained_signals_are_excluded() -> None:
    # a consistent liar makes consistency abstain at 0.0; it must NOT drag the vote
    v = Adjudicator().fuse(
        [
            DetectorSignal(detector="cross_examiner", suspicion=0.8),
            DetectorSignal(detector="consistency_auditor", suspicion=0.0, abstained=True),
        ]
    )
    # 0.8 alone -> raw = 2*(0.8-0.5) = 0.6; abstained consistency adds nothing
    assert v.label == "deceptive"
    assert abs(v.confidence - 0.6) < 1e-9


def test_all_abstained_is_uncertain_honest() -> None:
    v = Adjudicator().fuse(
        [DetectorSignal(detector="consistency_auditor", suspicion=0.0, abstained=True)]
    )
    assert v.label == "honest" and v.confidence == 0.5


# --- APR5: calibration map -----------------------------------------------------
def test_calibration_maps_fused_score_and_uses_its_threshold() -> None:
    # single-signal raw = 2*(s-0.5). sigmoid(10*raw - 5): raw 0.5 (s=0.75) -> 0.5;
    # raw 0.4 (s=0.7) -> sigmoid(-1) ~ 0.269
    adj = Adjudicator(calibration={"a": 10.0, "b": -5.0, "threshold": 0.5})
    v = adj.fuse([_sig("x", 0.75)])
    assert v.label == "deceptive" and abs(v.confidence - 0.5) < 1e-3
    v2 = adj.fuse([_sig("x", 0.7)])
    assert v2.label == "honest" and abs(v2.confidence - (1 - 0.2689)) < 1e-2


def test_no_calibration_falls_back_to_raw_noisy_or() -> None:
    # default (no calibration): raw = 2*(0.8-0.5) = 0.6 >= 0.40 threshold -> deceptive
    v = Adjudicator().fuse([_sig("x", 0.8)])
    assert v.label == "deceptive" and abs(v.confidence - 0.6) < 1e-9


def test_load_calibration_missing_is_none(tmp_path) -> None:  # type: ignore[no-untyped-def]
    from app.adjudicator import load_calibration

    assert load_calibration(tmp_path / "nope.json") is None


def test_load_calibration_reads_params(tmp_path) -> None:  # type: ignore[no-untyped-def]
    import json

    from app.adjudicator import load_calibration

    p = tmp_path / "calibration.json"
    p.write_text(json.dumps({"a": 4.0, "b": -2.0, "threshold": 0.45}))
    assert load_calibration(p) == {"a": 4.0, "b": -2.0, "threshold": 0.45}
