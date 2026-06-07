"""PR1: settings load from env with safe defaults (Tier 1)."""

import os
from unittest import mock

from app.config import Settings


def test_defaults_when_no_env() -> None:
    s = Settings(_env_file=None)  # ignore any local .env
    assert s.redis_url == "redis://localhost:6379"
    assert s.weave_project == "tell"
    assert s.openai_model  # has a default
    assert s.openai_api_key is None  # secret optional at import time


def test_env_overrides() -> None:
    env = {
        "OPENAI_MODEL": "some-model",
        "REDIS_URL": "redis://example:6380",
        "WEAVE_PROJECT": "tell-test",
        "OPENAI_API_KEY": "sk-test",
    }
    with mock.patch.dict(os.environ, env, clear=False):
        s = Settings(_env_file=None)
        assert s.openai_model == "some-model"
        assert s.redis_url == "redis://example:6380"
        assert s.weave_project == "tell-test"
        assert s.openai_api_key == "sk-test"
