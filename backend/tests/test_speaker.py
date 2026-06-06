"""PR3: speaker prompt construction + plumbing (Tier 1 — deterministic).

The "right kind of answer per mode" assertions are Tier 2 (fixtures, real model);
here we lock down the prompt invariants and message wiring with a mocked LLM.
"""

from unittest import mock

import pytest
from app import llm
from app.models import Mode, Role, SpeakerConfig, Utterance
from app.speaker import Speaker, SpeakerReply, build_system_prompt


def _cfg(mode: Mode) -> SpeakerConfig:
    return SpeakerConfig(topic="an expense report", mode=mode, secret="the dinner was personal")


@pytest.mark.parametrize("mode", [Mode.HONEST, Mode.LYING, Mode.STRATEGIC_DECEPTION])
def test_prompt_includes_secret_for_knowing_modes(mode: Mode) -> None:
    prompt = build_system_prompt(_cfg(mode))
    assert "the dinner was personal" in prompt
    assert "an expense report" in prompt


def test_hallucinating_prompt_omits_secret() -> None:
    prompt = build_system_prompt(_cfg(Mode.HALLUCINATING))
    assert "the dinner was personal" not in prompt
    assert "never admit uncertainty" in prompt.lower()


async def test_answer_returns_speaker_utterance(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        llm,
        "structured_call",
        mock.AsyncMock(return_value=SpeakerReply(answer="  It was a client dinner.  ")),
    )
    speaker = Speaker(_cfg(Mode.LYING))

    u = await speaker.answer("What was the $400 charge?")

    assert u.role is Role.SPEAKER
    assert u.text == "It was a client dinner."  # stripped
    assert u.turn == 1 and u.id == "s1"


async def test_answer_wires_system_history_and_question(monkeypatch: pytest.MonkeyPatch) -> None:
    spy = mock.AsyncMock(return_value=SpeakerReply(answer="ok"))
    monkeypatch.setattr(llm, "structured_call", spy)
    speaker = Speaker(_cfg(Mode.HONEST))

    history = [
        Utterance(id="q1", role=Role.EXAMINER, text="prior question"),
        Utterance(id="s1", role=Role.SPEAKER, text="prior answer"),
    ]
    u = await speaker.answer("the new question", history)

    messages = spy.await_args.args[0]
    assert messages[0]["role"] == "system"
    assert "an expense report" in messages[0]["content"]
    assert messages[1] == {"role": "user", "content": "prior question"}  # examiner -> user
    assert messages[2] == {"role": "assistant", "content": "prior answer"}  # speaker -> assistant
    assert messages[-1] == {"role": "user", "content": "the new question"}
    assert u.turn == 2 and u.id == "s2"  # one prior speaker turn
