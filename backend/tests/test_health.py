"""PR0: the scaffold is runnable — /health answers 200 {"status": "ok"}.

Tier 1 (deterministic, free): part of the green gate.
"""

from app.main import app
from fastapi.testclient import TestClient


def test_health_ok() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
