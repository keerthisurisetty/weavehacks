"""Deterministic dev/test split — the discipline that keeps us honest.

The whole accuracy effort rests on one rule: *never tune on the test set*. We
fit prompts, weights, and thresholds on **dev**, and report final numbers on a
held-out **test** split we touch only at milestones.

The split is:
- **Deterministic / seed-stable** — same seed always yields the same partition,
  across processes and machines. We hash the rid with ``hashlib`` (NOT the
  builtin ``hash()``, which is salted per-process via PYTHONHASHSEED).
- **Balanced by mode** — each mode is split independently at ``dev_frac``, so
  dev and test both contain every mode in proportion (a global shuffle could
  starve a mode in the smaller split).
"""

from __future__ import annotations

import hashlib
from collections import defaultdict
from typing import Any

Row = dict[str, Any]

DEFAULT_DEV_FRAC = 0.6
DEFAULT_SEED = 1729


def _order_key(seed: int, rid: str) -> str:
    """A stable, uniformly-distributed ordering key for a row id."""
    return hashlib.sha256(f"{seed}:{rid}".encode()).hexdigest()


def split_dataset(
    dataset: list[Row], *, dev_frac: float = DEFAULT_DEV_FRAC, seed: int = DEFAULT_SEED
) -> tuple[list[Row], list[Row]]:
    """Partition ``dataset`` into (dev, test), balanced by ``speaker_mode``.

    Within each mode the rows are ordered by a seeded hash of their rid and the
    first ``dev_frac`` go to dev, the rest to test. Deterministic for a given
    (dataset, dev_frac, seed). dev and test are disjoint and cover the dataset.
    """
    by_mode: dict[str, list[Row]] = defaultdict(list)
    for row in dataset:
        by_mode[row["speaker_mode"]].append(row)

    dev: list[Row] = []
    test: list[Row] = []
    for mode in sorted(by_mode):
        rows = sorted(by_mode[mode], key=lambda r: _order_key(seed, r["rid"]))
        k = round(len(rows) * dev_frac)
        dev.extend(rows[:k])
        test.extend(rows[k:])
    return dev, test


def select_split(dataset: list[Row], split: str, **kwargs: Any) -> list[Row]:
    """Return the named split: ``"dev"``, ``"test"``, or ``"all"`` (the union)."""
    if split == "all":
        return list(dataset)
    dev, test = split_dataset(dataset, **kwargs)
    if split == "dev":
        return dev
    if split == "test":
        return test
    raise ValueError(f"unknown split {split!r} (expected dev/test/all)")
