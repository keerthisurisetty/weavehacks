"""Vector store behind the Consistency Auditor.

Two implementations of one protocol:
- RedisVLStore: real RedisVL vector search on Redis Stack (the product + the
  Redis-prize signal).
- InMemoryVectorStore: cosine NN in pure Python, so the green gate tests the
  retrieval logic with fixed vectors and no Redis (fakeredis can't do KNN).
"""

from __future__ import annotations

import math
from typing import Protocol

import numpy as np
import redis.asyncio as aioredis
from redisvl.index import AsyncSearchIndex
from redisvl.query import VectorQuery

from app.config import settings

EMBED_DIM = 1536  # OpenAI text-embedding-3-small; must match the index schema


class VectorStore(Protocol):
    async def add(self, round_id: str, utt_id: str, text: str, embedding: list[float]) -> None: ...

    async def nearest(
        self, round_id: str, embedding: list[float], *, k: int = 3
    ) -> list[tuple[str, str]]:
        """Return up to k (utt_id, text) nearest to the embedding, within the round."""
        ...


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


class InMemoryVectorStore:
    """Deterministic cosine-NN store for tests (dimension-agnostic)."""

    def __init__(self) -> None:
        self._items: dict[str, list[tuple[str, str, list[float]]]] = {}

    async def add(self, round_id: str, utt_id: str, text: str, embedding: list[float]) -> None:
        self._items.setdefault(round_id, []).append((utt_id, text, embedding))

    async def nearest(
        self, round_id: str, embedding: list[float], *, k: int = 3
    ) -> list[tuple[str, str]]:
        items = self._items.get(round_id, [])
        ranked = sorted(items, key=lambda it: _cosine(embedding, it[2]), reverse=True)
        return [(utt_id, text) for utt_id, text, _emb in ranked[:k]]


_SCHEMA = {
    "index": {"name": "transcript", "prefix": "utt", "storage_type": "hash"},
    "fields": [
        {"name": "round_id", "type": "tag"},
        {"name": "utt_id", "type": "tag"},
        {"name": "text", "type": "text"},
        {
            "name": "embedding",
            "type": "vector",
            "attrs": {
                "dims": EMBED_DIM,
                "distance_metric": "cosine",
                "algorithm": "flat",
                "datatype": "float32",
            },
        },
    ],
}


def _to_bytes(vec: list[float]) -> bytes:
    return np.array(vec, dtype=np.float32).tobytes()


class RedisVLStore:
    """RedisVL-backed vector store (Redis Stack). Validated by scripts/consistency_smoke.py."""

    def __init__(self, index: AsyncSearchIndex) -> None:
        self._index = index

    @classmethod
    async def create(cls, *, redis_url: str | None = None, overwrite: bool = False) -> RedisVLStore:
        index = AsyncSearchIndex.from_dict(_SCHEMA)
        await index.set_client(aioredis.from_url(redis_url or settings.redis_url))
        await index.create(overwrite=overwrite)
        return cls(index)

    async def add(self, round_id: str, utt_id: str, text: str, embedding: list[float]) -> None:
        await self._index.load(
            [
                {
                    "round_id": round_id,
                    "utt_id": utt_id,
                    "text": text,
                    "embedding": _to_bytes(embedding),
                }
            ]
        )

    async def nearest(
        self, round_id: str, embedding: list[float], *, k: int = 3
    ) -> list[tuple[str, str]]:
        query = VectorQuery(
            vector=_to_bytes(embedding),
            vector_field_name="embedding",
            num_results=k,
            return_fields=["utt_id", "text"],
            filter_expression=f"@round_id:{{{round_id}}}",  # tag filter: only this round
        )
        hits = await self._index.query(query)
        return [(h["utt_id"], h["text"]) for h in hits]
