"""PR4: rule-based adjudicator fusion is deterministic (Tier 1)."""

from app.adjudicator import Adjudicator
from app.models import DetectorSignal


def _sig(name: str, s: float) -> DetectorSignal:
    return DetectorSignal(detector=name, suspicion=s)


def test_deceptive_above_threshold() -> None:
    v = Adjudicator().fuse([_sig("a", 0.8), _sig("b", 0.7)])
    assert v.label == "deceptive"
    assert v.confidence == 0.75  # mean


def test_honest_below_threshold() -> None:
    v = Adjudicator().fuse([_sig("a", 0.2)])
    assert v.label == "honest"
    assert v.confidence == 0.8  # 1 - mean


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
    # evidence_checker (w=1.3, 0.9) outweighs behavioral_analyst (w=0.8, 0.2)
    v = Adjudicator().fuse([_sig("evidence_checker", 0.9), _sig("behavioral_analyst", 0.2)])
    assert v.label == "deceptive"  # weighted mean ~0.63


def test_decisive_detector_accounts_for_weight() -> None:
    # behavioral 0.8*|0.45|=0.36 < evidence 1.3*|0.30|=0.39 -> evidence is decisive
    v = Adjudicator().fuse([_sig("behavioral_analyst", 0.95), _sig("evidence_checker", 0.8)])
    assert v.decisive_detector == "evidence_checker"
