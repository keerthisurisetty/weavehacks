"""Default detector panel.

The Cross-Examiner is both the questioner and a detector; the trio
(Cross-Examiner + Consistency + Behavioral) is the robust default. The Evidence
Checker is additive (needs web search) and the vector store defaults to in-memory
so a round runs with no external services.
"""

from __future__ import annotations

from app.detectors.base import Detector
from app.detectors.behavioral import BehavioralAnalyst
from app.detectors.consistency import ConsistencyAuditor
from app.detectors.cross_examiner import CrossExaminer
from app.detectors.evidence_checker import EvidenceChecker
from app.detectors.vector_store import InMemoryVectorStore, VectorStore


def default_panel(
    round_id: str,
    *,
    examiner: CrossExaminer | None = None,
    vector_store: VectorStore | None = None,
    with_evidence: bool = False,
) -> tuple[CrossExaminer, list[Detector]]:
    examiner = examiner or CrossExaminer()
    store = vector_store or InMemoryVectorStore()
    detectors: list[Detector] = [
        examiner,
        ConsistencyAuditor(round_id, store),
        BehavioralAnalyst(),
    ]
    if with_evidence:
        detectors.append(EvidenceChecker())
    return examiner, detectors
