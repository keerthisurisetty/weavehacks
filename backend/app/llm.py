"""Weave bootstrap + the single traced LLM chokepoint.

Every model call in the system goes through ``structured_call`` so that
(1) Weave traces it via ``@weave.op``, and (2) unit tests can monkeypatch ONE
function to make the whole system deterministic (see docs/TESTING.md).

``weave.init()`` must run once before the first traced/OpenAI call. ``init_weave``
is idempotent and is invoked by entrypoints (the smoke script, the orchestrator) —
never at import time, so importing this module never needs keys.
"""

from __future__ import annotations

import os
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
    # wandb/weave authenticate from the environment; surface the key from settings
    # (.env) so `make api` / scripts work without a separately-exported key.
    if settings.wandb_api_key:
        os.environ.setdefault("WANDB_API_KEY", settings.wandb_api_key)
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


async def embed_text(text: str, *, model: str = "text-embedding-3-small") -> list[float]:
    """Embed text for the consistency auditor's vector search (1536 dims).

    Routed through here (like structured_call) so tests monkeypatch one function.
    Auto-traced by Weave once init_weave has patched the client.
    """
    resp = await get_client().embeddings.create(model=model, input=text)
    return resp.data[0].embedding


async def gather_evidence(query: str, *, model: str | None = None) -> str:
    """Web-search-backed evidence for the Evidence Checker (Responses API).

    Returns "" if the tool/model is unavailable so a round never breaks — the
    detector then emits a neutral signal. To go on-brand for the Redis/W&B prizes,
    swap the tool for the W&B MCP server:
        tools=[{"type": "mcp", "server_url": "https://mcp.withwandb.com/mcp",
                "authorization": settings.wandb_api_key}]
    (Confirm the exact web_search tool name at the event.)
    """
    try:
        resp = await get_client().responses.create(
            model=model or settings.openai_model,
            tools=[{"type": "web_search"}],
            input=query,
        )
        return resp.output_text or ""
    except Exception:  # evidence is best-effort; never sink a round on it
        return ""
