"""Weave bootstrap + the single traced LLM chokepoint.

Every model call in the system goes through ``structured_call`` so that
(1) Weave traces it via ``@weave.op``, and (2) unit tests can monkeypatch ONE
function to make the whole system deterministic (see docs/TESTING.md).

``weave.init()`` must run once before the first traced/OpenAI call. ``init_weave``
is idempotent and is invoked by entrypoints (the smoke script, the orchestrator) —
never at import time, so importing this module never needs keys.
"""

from __future__ import annotations

from typing import Any, TypeVar, cast

import weave
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import settings

T = TypeVar("T", bound=BaseModel)

_client: AsyncOpenAI | None = None
_weave_ready = False


def init_weave(project: str | None = None) -> None:
    """Idempotently start Weave tracing. Call once, before the first model call."""
    global _weave_ready
    if _weave_ready:
        return
    weave.init(project or settings.weave_project)
    _weave_ready = True


def get_client() -> AsyncOpenAI:
    """Lazily build the async OpenAI client.

    Lazy so that, when an entrypoint calls ``init_weave`` first, Weave has already
    patched the OpenAI SDK and the call is auto-traced. ``api_key=None`` falls back
    to the OPENAI_API_KEY env var.
    """
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


@weave.op
async def structured_call(
    messages: list[dict[str, str]],
    schema: type[T],
    *,
    model: str | None = None,
    temperature: float = 0.2,
) -> T:
    """One traced, typed model call: messages -> a validated ``schema`` instance.

    Low ``temperature`` by default (detectors/adjudicator want determinism); the
    speaker can pass a warmer value.
    """
    client = get_client()
    resp = await client.chat.completions.parse(
        model=model or settings.openai_model,
        messages=cast(Any, messages),
        response_format=schema,
        temperature=temperature,
    )
    parsed = resp.choices[0].message.parsed
    if parsed is None:
        raise ValueError("structured_call: model returned no parsed output (refusal?)")
    return parsed
