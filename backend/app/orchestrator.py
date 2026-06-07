"""The round orchestrator — speaker <-> cross-examiner loop with a detector panel.

A custom async orchestrator (no agent framework) so the Weave trace tree is
exactly round -> speaker / each detector / adjudicator. Each turn: the
Cross-Examiner asks, the speaker answers, then the whole panel assesses
CONCURRENTLY; the adjudicator fuses the latest signal per detector. After each
step it emits a RoundEvent through an optional sink (CLI / Redis / AG-UI).

Progress is kept SEPARATE from suspicion: it only ever fills toward 100%.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

import weave

from app import memory
from app.adjudicator import Adjudicator, load_calibration
from app.detectors.base import Detector
from app.detectors.cross_examiner import CrossExaminer
from app.detectors.panel import default_panel
from app.detectors.vector_store import VectorStore
from app.events import EventSink, RoundEvent
from app.llm import init_weave
from app.models import DetectorSignal, Phase, Role, Round, SpeakerConfig, Utterance, Verdict
from app.speaker import Speaker

DEFAULT_MAX_TURNS = 4
SHORT_CIRCUIT_CONFIDENCE = 0.85
MIN_TURNS_BEFORE_CALL = 2  # apply some pressure before ending early

# Returns a queued human question (HITL) or None to let the examiner generate one.
QuestionSource = Callable[[], Awaitable[str | None]]


def compute_progress(phase: Phase, turns_done: int, max_turns: int) -> int:
    """Phase-weighted, monotonic progress %. Pure function (heavily unit-tested).

    setup -> 5; interrogation -> 5 + 70*turns_done/max_turns (capped 75);
    deliberation -> 95; verdict -> 100.
    """
    if phase is Phase.SETUP:
        return 5
    if phase is Phase.INTERROGATION:
        frac = (turns_done / max_turns) if max_turns > 0 else 1.0
        return min(75, round(5 + 70 * frac))
    if phase is Phase.DELIBERATION:
        return 95
    return 100  # VERDICT


async def _emit(sink: EventSink | None, event: RoundEvent) -> None:
    if sink is not None:
        await sink(event)


async def _progress(sink: EventSink | None, phase: Phase, turns_done: int, max_turns: int) -> None:
    await _emit(
        sink,
        RoundEvent(
            kind="progress", phase=phase, progress=compute_progress(phase, turns_done, max_turns)
        ),
    )


async def _next_question(
    examiner: CrossExaminer,
    topic: str,
    transcript: list[Utterance],
    question_source: QuestionSource | None,
) -> tuple[str, Role]:
    """A queued human interjection (HITL) takes the next turn; else the
    cross-examiner generates the question."""
    if question_source is not None:
        human_q = await question_source()
        if human_q:
            return human_q, Role.HUMAN
    return await examiner.question(topic, transcript), Role.EXAMINER


@weave.op
async def run_round(
    cfg: SpeakerConfig,
    *,
    detectors: list[Detector] | None = None,
    examiner: CrossExaminer | None = None,
    vector_store: VectorStore | None = None,
    max_turns: int = DEFAULT_MAX_TURNS,
    emit: EventSink | None = None,
    rid: str = "r_local",
    init_tracing: bool = False,
    persist: bool = False,
    with_evidence: bool = False,
    question_source: QuestionSource | None = None,
) -> Round:
    """Run one interrogation round and return the scored Round.

    ``detectors`` controls which signals feed the verdict (default: the full
    panel). The Cross-Examiner always drives the questions. Pass a single-element
    ``detectors`` list for the panel-vs-single comparison.
    """
    if init_tracing:
        init_weave()

    rnd = Round.from_config(rid, cfg)
    speaker = Speaker(cfg)
    if detectors is None:
        examiner, detectors = default_panel(
            rid, examiner=examiner, vector_store=vector_store, with_evidence=with_evidence
        )
    elif examiner is None:
        examiner = CrossExaminer()
    adjudicator = Adjudicator(calibration=load_calibration())

    transcript = rnd.transcript
    signals = rnd.signals
    latest: dict[str, DetectorSignal] = {}  # current suspicion per detector (drives meters)

    await _progress(emit, Phase.SETUP, 0, max_turns)

    question, q_role = await _next_question(examiner, cfg.topic, transcript, question_source)
    verdict: Verdict | None = None

    for turn in range(1, max_turns + 1):
        history = list(transcript)
        q_utt = Utterance(id=f"q{turn}", role=q_role, text=question)
        transcript.append(q_utt)
        await _emit(emit, RoundEvent(kind="utterance", utterance=q_utt))

        answer = await speaker.answer(question, history)
        transcript.append(answer)
        await _emit(emit, RoundEvent(kind="utterance", utterance=answer))

        # The whole panel assesses the new turn concurrently.
        new_signals = await asyncio.gather(*(d.assess(cfg.topic, transcript) for d in detectors))
        for sig in new_signals:
            signals.append(sig)
            latest[sig.detector] = sig
            await _emit(emit, RoundEvent(kind="signal", signal=sig))

        await _progress(emit, Phase.INTERROGATION, turn, max_turns)

        # The adjudicator owns when-to-call: end early only to CALL a deception,
        # and only after a few turns of pressure — never end early on a (possibly
        # over-confident) honest read, which is how a smooth liar slips through.
        interim = adjudicator.fuse(list(latest.values()))
        if (
            interim.label == "deceptive"
            and interim.confidence >= SHORT_CIRCUIT_CONFIDENCE
            and turn >= MIN_TURNS_BEFORE_CALL
        ):
            verdict = interim
            break

        if turn < max_turns:
            question, q_role = await _next_question(
                examiner, cfg.topic, transcript, question_source
            )

    await _progress(emit, Phase.DELIBERATION, max_turns, max_turns)
    if verdict is None:
        verdict = adjudicator.fuse(list(latest.values()))
    rnd.verdict = verdict
    rnd.score()
    if persist:
        await memory.persist_result(rnd)

    await _progress(emit, Phase.VERDICT, max_turns, max_turns)
    await _emit(emit, RoundEvent(kind="verdict", verdict=verdict))
    # The ground-truth reveal — the only event carrying secret/mode (post-verdict).
    await _emit(
        emit,
        RoundEvent(
            kind="reveal",
            mode=cfg.mode,
            ground_truth=rnd.ground_truth,
            secret=cfg.secret,
            correct=rnd.correct,
        ),
    )
    return rnd
