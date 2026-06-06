"""PR2: structured_call plumbing is deterministic when the client is mocked (Tier 1).

No real OpenAI/Weave calls — we monkeypatch get_client, the one network boundary.
"""

from unittest import mock

import pytest
from app import llm
from pydantic import BaseModel


class _Out(BaseModel):
    answer: str


def _fake_client(parsed: object) -> mock.Mock:
    client = mock.Mock()
    resp = mock.Mock()
    resp.choices = [mock.Mock(message=mock.Mock(parsed=parsed))]
    client.chat.completions.parse = mock.AsyncMock(return_value=resp)
    return client


async def test_structured_call_returns_parsed(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _fake_client(_Out(answer="pong"))
    monkeypatch.setattr(llm, "get_client", lambda: client)

    out = await llm.structured_call([{"role": "user", "content": "ping"}], _Out)

    assert isinstance(out, _Out)
    assert out.answer == "pong"
    client.chat.completions.parse.assert_awaited_once()
    kwargs = client.chat.completions.parse.await_args.kwargs
    assert kwargs["response_format"] is _Out
    assert kwargs["model"] == llm.settings.openai_model  # default forwarded


async def test_structured_call_forwards_model_and_temperature(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = _fake_client(_Out(answer="x"))
    monkeypatch.setattr(llm, "get_client", lambda: client)

    await llm.structured_call(
        [{"role": "user", "content": "x"}], _Out, model="m-test", temperature=0.0
    )

    kwargs = client.chat.completions.parse.await_args.kwargs
    assert kwargs["model"] == "m-test"
    assert kwargs["temperature"] == 0.0


async def test_structured_call_raises_on_no_parse(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _fake_client(None)
    monkeypatch.setattr(llm, "get_client", lambda: client)

    with pytest.raises(ValueError, match="no parsed output"):
        await llm.structured_call([{"role": "user", "content": "x"}], _Out)
