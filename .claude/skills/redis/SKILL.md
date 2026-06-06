# SKILL: Redis (pub/sub bus + RedisVL vector search + sorted sets)

**When to use:** the real-time utterance bus, the Consistency Auditor's contradiction search, and the detector leaderboard. Read before writing Redis code.

## Run Redis (must be Redis Stack for vector search)
```bash
docker run -d --name redis -p 6379:6379 -p 8001:8001 redis/redis-stack:latest
# RedisInsight UI at http://localhost:8001
```
Alternative: Redis Cloud free tier (gives a hosted URL; Redis sponsor may grant credits at the event). Set `REDIS_URL=redis://localhost:6379`.
```bash
pip install "redis>=5" redisvl
```
Use `redis.asyncio` everywhere (the orchestrator is async).

## 1) Pub/Sub — the live event bus (drives the meters)
Each speaker utterance is published; detectors subscribe and react; detector signals are published back for the UI.
```python
import json, redis.asyncio as redis
r = redis.from_url(REDIS_URL, decode_responses=True)

# publish an utterance
await r.publish(f"round:{rid}:utterance", json.dumps({"speaker": "S", "text": "..."}))

# subscribe (each detector, and the UI bridge)
pubsub = r.pubsub()
await pubsub.subscribe(f"round:{rid}:utterance")
async for msg in pubsub.listen():
    if msg["type"] != "message":
        continue
    utterance = json.loads(msg["data"])
    # ... score it, then publish a signal:
    await r.publish(f"round:{rid}:signal", json.dumps({"detector": "consistency", "suspicion": 0.78}))
```
Pub/Sub is fire-and-forget (no history). That's fine for live meters. If you want a replayable log, use a Redis **Stream** (`xadd`/`xread`) instead — optional.

## 2) RedisVL — vector search for the Consistency Auditor
Goal: embed each speaker statement, then for a new claim find earlier statements it contradicts.

Schema (dict form; `dims` must match your embedding model — 1536 for OpenAI `text-embedding-3-small`):
```python
schema = {
  "index": {"name": "transcript", "prefix": "utt", "storage_type": "hash"},
  "fields": [
    {"name": "round_id", "type": "tag"},
    {"name": "text", "type": "text"},
    {"name": "embedding", "type": "vector",
     "attrs": {"dims": 1536, "distance_metric": "cosine", "algorithm": "flat", "datatype": "float32"}},
  ],
}
```
Create + load + query (async):
```python
import numpy as np, redis.asyncio as aredis
from redisvl.index import AsyncSearchIndex
from redisvl.query import VectorQuery

index = AsyncSearchIndex.from_dict(schema)
await index.set_client(aredis.from_url(REDIS_URL))
await index.create(overwrite=True)

def to_bytes(vec): return np.array(vec, dtype=np.float32).tobytes()

await index.load([{"round_id": rid, "text": utt, "embedding": to_bytes(emb)}])

q = VectorQuery(
    vector=to_bytes(new_claim_emb),
    vector_field_name="embedding",
    num_results=3,
    return_fields=["text"],
    filter_expression="@round_id:{%s}" % rid,   # hybrid: vector + tag filter, only this round
)
hits = await index.query(q)   # nearest prior statements; feed to the LLM to check for contradiction
```
Embeddings come from OpenAI (`text-embedding-3-small`) — see the openai skill.

## 3) Sorted sets — detector leaderboard / tell library
```python
await r.zincrby("leaderboard:correct", 1, "consistency")     # tally correct calls per detector
top = await r.zrevrange("leaderboard:correct", 0, -1, withscores=True)
```

## Sponsor-prize note (use ≥3 capabilities, each load-bearing)
Pub/Sub (live fan-out) + RedisVL vector search (contradiction-finding) + sorted sets (leaderboard) = a real multi-capability Redis story, not "we cached a thing." Optionally add semantic caching (LangCache / RedisVL `SemanticCache`) for repeated evidence lookups.

## Gotchas
- Vector search needs **Redis Stack**, not vanilla redis.
- The query vector's `dims`/`datatype` must exactly match the index field.
- `redis.asyncio` for async; don't mix sync and async clients.
- Confirm RedisVL class/arg names against https://docs.redisvl.com if an import errors (API is stable around `SearchIndex`/`AsyncSearchIndex` + `VectorQuery`).
