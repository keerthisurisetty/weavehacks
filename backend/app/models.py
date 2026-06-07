"""The typed vocabulary everything else imports (mirrors docs/SPEC.md §8).

Pydantic v2 models. Two invariants encoded here:
- ``suspicion`` and ``confidence`` are probabilities in [0, 1] (validated).
- ``SpeakerConfig`` is the *only* place the secret + mode live. It must never be
  handed to a detector or the adjudicator — they see transcript + signals only.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

# A verdict / ground-truth is binary: honest vs deceptive.
Label = Literal["honest", "deceptive"]
Difficulty = Literal["easy", "medium", "hard"]


class Mode(StrEnum):
    """The speaker's assigned mode — the ground-truth oracle (SPEC §6)."""

    HONEST = "honest"
    LYING = "lying"
    STRATEGIC_DECEPTION = "strategic_deception"
    HALLUCINATING = "hallucinating"

    @property
    def ground_truth(self) -> Label:
        """Collapse the four modes to the binary label the panel is scored on."""
        return "honest" if self is Mode.HONEST else "deceptive"


class Phase(StrEnum):
    """Where a round is in its lifecycle — drives the (separate) progress bar."""

    SETUP = "setup"
    INTERROGATION = "interrogation"
    DELIBERATION = "deliberation"
    VERDICT = "verdict"


class Role(StrEnum):
    """Who produced a transcript line."""

    SPEAKER = "speaker"
    EXAMINER = "examiner"  # cross-examiner agent
    HUMAN = "human"  # a human interjection (HITL)


class Utterance(BaseModel):
    """One line of the transcript."""

    id: str
    role: Role
    text: str
    turn: int | None = None


class DetectorSignal(BaseModel):
    """A live suspicion reading from one detector (drives a meter)."""

    detector: str
    suspicion: float = Field(ge=0.0, le=1.0)  # 0..1
    utterance_ref: str | None = None
    evidence: str | None = None
    rationale: str = ""
    # True when the detector has no basis to judge (e.g. a contradiction-finder
    # that found no contradiction). Abstaining signals are excluded from fusion —
    # absence of evidence is not evidence of honesty.
    abstained: bool = False


class Verdict(BaseModel):
    """The adjudicator's fused, calibrated call."""

    label: Label
    confidence: float = Field(ge=0.0, le=1.0)  # calibrated probability
    contributing_signals: list[str] = Field(default_factory=list)
    decisive_detector: str | None = None


class SpeakerConfig(BaseModel):
    """Private briefing for the speaker. NEVER passed to a detector/adjudicator."""

    topic: str
    mode: Mode
    secret: str
    difficulty: Difficulty = "medium"


class RoundProgress(BaseModel):
    """Streamed-state slice for the progress indicator (phase + monotonic %)."""

    phase: Phase
    progress: int = Field(ge=0, le=100)


class Round(BaseModel):
    """A full interrogation round and its scored outcome (SPEC §8)."""

    id: str
    topic: str
    speaker_mode: Mode
    secret: str
    difficulty: Difficulty = "medium"
    transcript: list[Utterance] = Field(default_factory=list)
    signals: list[DetectorSignal] = Field(default_factory=list)
    verdict: Verdict | None = None
    ground_truth: Label | None = None
    correct: bool | None = None

    @classmethod
    def from_config(cls, rid: str, cfg: SpeakerConfig) -> Round:
        """Open a round from a speaker briefing, stamping the ground truth."""
        return cls(
            id=rid,
            topic=cfg.topic,
            speaker_mode=cfg.mode,
            secret=cfg.secret,
            difficulty=cfg.difficulty,
            ground_truth=cfg.mode.ground_truth,
        )

    def score(self) -> bool:
        """Set ``correct`` by comparing the verdict to ground truth. Idempotent."""
        if self.verdict is None or self.ground_truth is None:
            self.correct = None
        else:
            self.correct = self.verdict.label == self.ground_truth
        return bool(self.correct)


class EvalResult(BaseModel):
    """Aggregate metrics over a suite of rounds (the Weave eval output)."""

    n_rounds: int = Field(ge=0)
    accuracy: float = Field(ge=0.0, le=1.0)
    false_positive_rate: float = Field(ge=0.0, le=1.0)
    brier_score: float = Field(ge=0.0)
    by_mode: dict[str, float] = Field(default_factory=dict)
    panel_vs_best_single: dict[str, float] = Field(default_factory=dict)
