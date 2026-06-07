"""APR0: the measurement foundation is deterministic and correct (Tier 1).

Covers the pure parts — dataset integrity, the seed-stable dev/test split, and
the metric aggregation — without touching a model. The round-running parts are
exercised at Tier 2/3 (token cost) via ``make eval``.
"""

from collections import Counter

from eval.dataset import DATASET
from eval.harness import Outcome, aggregate, label_stability
from eval.splits import select_split, split_dataset

MODES = ["honest", "lying", "strategic_deception", "hallucinating"]


# --- dataset integrity -------------------------------------------------------
def test_dataset_is_balanced_and_well_formed() -> None:
    assert len(DATASET) >= 60
    counts = Counter(r["speaker_mode"] for r in DATASET)
    assert set(counts) == set(MODES)
    # balanced by mode (the split relies on this)
    assert len(set(counts.values())) == 1, f"modes not balanced: {counts}"
    rids = [r["rid"] for r in DATASET]
    assert len(rids) == len(set(rids)), "rids must be unique"
    for r in DATASET:
        assert r.keys() >= {"rid", "topic", "speaker_mode", "secret", "difficulty"}
        assert r["difficulty"] in {"easy", "medium", "hard"}
        assert r["topic"] and r["secret"]


# --- dev/test split ----------------------------------------------------------
def test_split_is_deterministic() -> None:
    a_dev, a_test = split_dataset(DATASET, seed=1729)
    b_dev, b_test = split_dataset(DATASET, seed=1729)
    assert [r["rid"] for r in a_dev] == [r["rid"] for r in b_dev]
    assert [r["rid"] for r in a_test] == [r["rid"] for r in b_test]


def test_split_partitions_the_dataset() -> None:
    dev, test = split_dataset(DATASET)
    dev_ids = {r["rid"] for r in dev}
    test_ids = {r["rid"] for r in test}
    assert dev_ids.isdisjoint(test_ids)
    assert dev_ids | test_ids == {r["rid"] for r in DATASET}


def test_split_is_balanced_by_mode() -> None:
    dev, test = split_dataset(DATASET, dev_frac=0.6)
    per_mode = len(DATASET) // len(MODES)
    k = round(per_mode * 0.6)
    for mode in MODES:
        assert sum(r["speaker_mode"] == mode for r in dev) == k
        assert sum(r["speaker_mode"] == mode for r in test) == per_mode - k


def test_different_seeds_can_differ() -> None:
    dev_a, _ = split_dataset(DATASET, seed=1)
    dev_b, _ = split_dataset(DATASET, seed=2)
    assert [r["rid"] for r in dev_a] != [r["rid"] for r in dev_b]


def test_select_split_all_is_full_dataset() -> None:
    assert {r["rid"] for r in select_split(DATASET, "all")} == {r["rid"] for r in DATASET}


# --- metric aggregation ------------------------------------------------------
def _o(mode: str, label: str, conf: float) -> Outcome:
    return Outcome(rid="x", speaker_mode=mode, label=label, confidence=conf)


def test_aggregate_computes_accuracy_fpr_brier_confusion() -> None:
    outcomes = [
        _o("honest", "honest", 0.9),  # TN, brier (0.1)^2 = 0.01
        _o("honest", "deceptive", 0.8),  # FP, brier (0.8)^2 = 0.64
        _o("lying", "deceptive", 0.7),  # TP, brier (0.3)^2 = 0.09
        _o("lying", "honest", 0.6),  # FN, brier (0.6)^2 = 0.36
    ]
    m = aggregate(outcomes)
    assert m.n == 4
    assert m.accuracy == 0.5
    assert m.fpr == 0.5  # 1 FP out of 2 honest
    assert abs(m.brier - 0.275) < 1e-9
    assert m.by_mode["honest"] == 0.5
    assert m.by_mode["lying"] == 0.5
    assert m.confusion == {"tp": 1, "fp": 1, "tn": 1, "fn": 1}


def test_aggregate_empty_is_zeroed() -> None:
    m = aggregate([])
    assert m.n == 0 and m.accuracy == 0.0


def test_fpr_is_zero_when_no_honest_rows() -> None:
    m = aggregate([_o("lying", "deceptive", 0.9)])
    assert m.fpr == 0.0
    assert m.accuracy == 1.0


# --- variance metric ---------------------------------------------------------
def test_label_stability_mixes_modal_and_unanimous() -> None:
    per_row = [
        [_o("lying", "deceptive", 0.8) for _ in range(3)],  # unanimous
        [_o("lying", "deceptive", 0.8), _o("lying", "honest", 0.5), _o("lying", "deceptive", 0.8)],
    ]
    stab = label_stability(per_row)
    assert abs(stab["mean_modal_fraction"] - (1.0 + 2 / 3) / 2) < 1e-9
    assert stab["unanimous_fraction"] == 0.5
    assert stab["n_rounds"] == 2
    assert stab["trials"] == 3


def test_label_stability_empty() -> None:
    stab = label_stability([])
    assert stab["mean_modal_fraction"] == 1.0 and stab["n_rounds"] == 0
