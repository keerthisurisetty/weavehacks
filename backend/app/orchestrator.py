"""The round orchestrator — speaker <-> cross-examiner loop, then a verdict.

A custom async orchestrator (no agent framework) so the Weave trace tree is
exactly round -> speaker / examiner / adjudicator. After each step it emits a
RoundEvent (utterance / signal / progress / verdict) through an optional sink,
so any transport (CLI print, Redis pub/sub, AG-UI) plugs in the same way.

Progress is kept SEPARATE from suspicion: it only ever fills toward 100%.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

import weave

from app.adjudicator import Adjudicator
from app.detectors.cross_examiner import CrossExaminer
from app.events import RoundEvent
from app.llm import init_weave
from app.models import Phase, Role, Round, SpeakerConfig, Utterance, Verdict
from app.speaker import Speaker

EventSink = Callable[[RoundEvent], Awaitable[None]]

DEFAULT_MAX_TURNS = 4
SHORT_CIRCUIT_CONFIDENCE = 0.85


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


@weave.op
async def run_round(
    cfg: SpeakerConfig,
    *,
    max_turns: int = DEFAULT_MAX_TURNS,
    emit: EventSink | None = None,
    rid: str = "r_local",
    init_tracing: bool = False,
) -> Round:
    """Run one interrogation round and return the scored Round."""
    if init_tracing:
        init_weave()

    rnd = Round.from_config(rid, cfg)
    speaker = Speaker(cfg)
    examiner = CrossExaminer()
    adjudicator = Adjudicator()
    transcript = rnd.transcript
    signals = rnd.signals

    await _progress(emit, Phase.SETUP, 0, max_turns)

    question = await examiner.question(cfg.topic, transcript)
    verdict: Verdict | None = None

    for turn in range(1, max_turns + 1):
        history = list(transcript)
        q_utt = Utterance(id=f"q{turn}", role=Role.EXAMINER, text=question)
        transcript.append(q_utt)
        await _emit(emit, RoundEvent(kind="utterance", utterance=q_utt))

        answer = await speaker.answer(question, history)
        transcript.append(answer)
        await _emit(emit, RoundEvent(kind="utterance", utterance=answer))

        signal = await examiner.assess(cfg.topic, transcript)
        signals.append(signal)
        await _emit(emit, RoundEvent(kind="signal", signal=signal))

        await _progress(emit, Phase.INTERROGATION, turn, max_turns)

        # The adjudicator owns when-to-call: stop early once confident enough.
        interim = adjudicator.fuse(signals)
        if interim.confidence >= SHORT_CIRCUIT_CONFIDENCE:
            verdict = interim
            break

        if turn < max_turns:
            question = await examiner.question(cfg.topic, transcript)

    await _progress(emit, Phase.DELIBERATION, max_turns, max_turns)
    if verdict is None:
        verdict = adjudicator.fuse(signals)
    rnd.verdict = verdict
    rnd.score()

    await _progress(emit, Phase.VERDICT, max_turns, max_turns)
    await _emit(emit, RoundEvent(kind="verdict", verdict=verdict))
    return rnd
