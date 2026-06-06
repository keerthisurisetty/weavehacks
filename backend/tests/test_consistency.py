"""PR7: consistency auditor over fixed vectors (Tier 1, no real Redis/embeddings).

InMemoryVectorStore does the cosine NN; llm.embed_text + structured_call are mocked.
"""

import pytest
from app import llm
from app.detectors.base import Assessment
from app.detectors.consistency import ConsistencyAuditor
from app.detectors.vector_store import InMemoryVectorStore
from app.models import Role, Utterance

# Planted 2-D vectors: "client" and "personal" point the same way (near);
# "weather" is orthogonal (far).
_VECTORS = {
    "the dinner was a client meeting": [1.0, 0.0],
    "the dinner was personal": [0.96, 0.04],
    "it was raining that day": [0.0, 1.0],
}


async def _fake_embed(text: str, **_: object) -> list[float]:
    return _VECTORS[text]


async def test_inmemory_nearest_returns_closest() -> None:
    store = InMemoryVectorStore()
    await store.add("r", "s1", "the dinner was a client meeting", [1.0, 0.0])
    await store.add("r", "s2", "it was raining that day", [0.0, 1.0])

    near = await store.nearest("r", [0.96, 0.04], k=1)
    assert near[0][0] == "s1"  # closest is the client-meeting line


async def test_inmemory_scopes_by_round() -> None:
    store = InMemoryVectorStore()
    await store.add("rA", "s1", "x", [1.0, 0.0])
    assert await store.nearest("rB", [1.0, 0.0], k=3) == []  # different round -> nothing


async def test_first_statement_has_no_priors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "embed_text", _fake_embed)
    auditor = ConsistencyAuditor("r1", InMemoryVectorStore())

    sig = await auditor.assess(
        "t", [Utterance(id="s1", role=Role.SPEAKER, text="the dinner was a client meeting")]
    )
    assert sig.suspicion == 0.0
    assert sig.utterance_ref == "s1"


async def test_contradiction_raises_suspicion_and_cites_prior(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(llm, "embed_text", _fake_embed)

    async def fake_contradiction(messages: list[dict], schema: type, **_: object) -> Assessment:
        # the model sees s1 among the nearest and flags the contradiction
        return Assessment(
            suspicion=0.9, rationale="contradicts the earlier client-meeting claim", evidence="s1"
        )

    monkeypatch.setattr(llm, "structured_call", fake_contradiction)
    auditor = ConsistencyAuditor("r1", InMemoryVectorStore())

    s1 = Utterance(id="s1", role=Role.SPEAKER, text="the dinner was a client meeting")
    await auditor.assess("t", [s1])  # loads s1

    s2 = Utterance(id="s2", role=Role.SPEAKER, text="the dinner was personal")
    sig = await auditor.assess("t", [s1, s2])

    assert sig.suspicion == 0.9
    assert sig.evidence == "s1"
    assert sig.utterance_ref == "s2"


async def test_consistent_statement_stays_low(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "embed_text", _fake_embed)

    async def fake_consistent(messages: list[dict], schema: type, **_: object) -> Assessment:
        return Assessment(suspicion=0.1, rationale="consistent", evidence=None)

    monkeypatch.setattr(llm, "structured_call", fake_consistent)
    auditor = ConsistencyAuditor("r1", InMemoryVectorStore())

    s1 = Utterance(id="s1", role=Role.SPEAKER, text="the dinner was a client meeting")
    await auditor.assess("t", [s1])
    s2 = Utterance(id="s2", role=Role.SPEAKER, text="the dinner was personal")
    sig = await auditor.assess("t", [s1, s2])
    assert sig.suspicion == 0.1
