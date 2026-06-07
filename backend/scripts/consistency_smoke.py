"""PR7 smoke: real RedisVL vector search over real OpenAI embeddings.

Start Redis Stack (`make redis`) and set OPENAI_API_KEY, then from backend/:

    ../.venv/bin/python -m scripts.consistency_smoke

Loads two contradictory statements and confirms the auditor's suspicion rises and
cites the earlier line (the PR7 "done when", end to end against real RedisVL).
"""

from __future__ import annotations

import asyncio

from app.detectors.consistency import ConsistencyAuditor
from app.detectors.vector_store import RedisVLStore
from app.llm import init_weave
from app.models import Role, Utterance


async def main() -> None:
    init_weave()
    store = await RedisVLStore.create(overwrite=True)
    auditor = ConsistencyAuditor("r_smoke", store)

    s1 = Utterance(
        id="s1", role=Role.SPEAKER, text="The $400 dinner was a client meeting with the buyer."
    )
    s2 = Utterance(
        id="s2", role=Role.SPEAKER, text="Actually the dinner was personal — just me and a friend."
    )

    first = await auditor.assess("expense report", [s1])
    print(f"after s1: suspicion={first.suspicion:.2f} ({first.rationale})")

    second = await auditor.assess("expense report", [s1, s2])
    print(
        f"after s2: suspicion={second.suspicion:.2f} evidence={second.evidence} ({second.rationale})"
    )


if __name__ == "__main__":
    asyncio.run(main())
