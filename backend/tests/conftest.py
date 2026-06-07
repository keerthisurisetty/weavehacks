"""Shared test guards.

The green gate must stay free, fast, and offline. The API now initializes Weave
at startup when a W&B key is present (so UI rounds trace) — but tests must never
hit the network, so we stub init_weave for the whole suite regardless of .env.

We also neutralize the APR5 calibration map: the committed app/calibration.json is
fit to a specific model, so loading it would make the orchestrator's stub-based
verdict tests model-dependent. The calibration math itself is unit-tested directly
in test_adjudicator; here run_round uses the raw fusion so tests stay deterministic.
"""

import pytest


@pytest.fixture(autouse=True)
def _no_weave_init(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.main.init_weave", lambda *args, **kwargs: None, raising=False)
    monkeypatch.setattr("app.orchestrator.load_calibration", lambda *a, **k: None, raising=False)
