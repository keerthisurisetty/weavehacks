"""PR12: the curated demo arc is well-formed (Tier 1; the live run needs keys)."""

from app.models import Mode
from scripts.demo import DEMO_ROUNDS


def test_three_curated_rounds() -> None:
    assert len(DEMO_ROUNDS) == 3


def test_demo_arc_is_honest_then_lie_then_strategic() -> None:
    assert [r.cfg.mode for r in DEMO_ROUNDS] == [
        Mode.HONEST,
        Mode.LYING,
        Mode.STRATEGIC_DECEPTION,
    ]


def test_each_round_is_fully_specified() -> None:
    for r in DEMO_ROUNDS:
        assert r.title and r.note
        assert r.cfg.topic and r.cfg.secret
