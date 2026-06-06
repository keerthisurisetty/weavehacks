"""PR2 smoke: one real, traced structured call — proves Weave tracing end to end.

Needs WANDB_API_KEY + OPENAI_API_KEY (and OPENAI_MODEL). Run from backend/:

    cd backend && ../.venv/bin/python -m scripts.smoke_weave

Then open the printed Weave project URL and confirm the ``structured_call`` span.
"""

from __future__ import annotations

import asyncio

from app.llm import init_weave, structured_call
from pydantic import BaseModel


class Ping(BaseModel):
    answer: str


async def main() -> None:
    init_weave()
    out = await structured_call(
        [{"role": "user", "content": "Reply with exactly one word: pong"}],
        Ping,
    )
    print("structured_call ->", out)


if __name__ == "__main__":
    asyncio.run(main())
