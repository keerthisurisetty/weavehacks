"""Runtime settings, read from the environment (and .env when present).

Secrets default to None so the package imports and unit-tests run without keys;
they're only required when actually calling a model / Weave (PR2+).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Secrets (required at call time, optional at import/test time).
    openai_api_key: str | None = None
    wandb_api_key: str | None = None

    # Non-secret config with sensible local defaults.
    openai_model: str = "gpt-4o-2024-08-06"
    redis_url: str = "redis://localhost:6379"
    weave_project: str = "tell"


settings = Settings()
