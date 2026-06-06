"""PR4: progress math — pure, monotonic, bounded (Tier 1)."""

from app.models import Phase
from app.orchestrator import compute_progress


def test_setup_is_5() -> None:
    assert compute_progress(Phase.SETUP, 0, 4) == 5


def test_interrogation_monotonic_and_bounded() -> None:
    vals = [compute_progress(Phase.INTERROGATION, t, 4) for t in range(5)]
    assert vals == sorted(vals)  # never goes backwards
    assert vals[0] >= 5 and vals[-1] <= 75


def test_deliberation_then_verdict() -> None:
    assert compute_progress(Phase.DELIBERATION, 4, 4) == 95
    assert compute_progress(Phase.VERDICT, 4, 4) == 100


def test_full_sequence_monotonic_to_100() -> None:
    seq = [compute_progress(Phase.SETUP, 0, 4)]
    seq += [compute_progress(Phase.INTERROGATION, t, 4) for t in range(1, 5)]
    seq += [compute_progress(Phase.DELIBERATION, 4, 4), compute_progress(Phase.VERDICT, 4, 4)]
    assert seq == sorted(seq)
    assert seq[-1] == 100


def test_zero_max_turns_does_not_crash() -> None:
    assert compute_progress(Phase.INTERROGATION, 0, 0) == 75
