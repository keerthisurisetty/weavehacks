"""Shared test guards.

The green gate must stay free, fast, and offline. The API now initializes Weave
at startup when a W&B key is present (so UI rounds trace) — but tests must never
hit the network, so we stub init_weave for the whole suite regardless of .env.
"""

import pytest


@pytest.fixture(autouse=True)
def _no_weave_init(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.main.init_weave", lambda *args, **kwargs: None, raising=False)
