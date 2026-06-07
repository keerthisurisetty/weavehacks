"""Runtime settings, read from the environment (and .env when present).

Secrets default to None so the package imports and unit-tests run without keys;
they're only required when actually calling a model / Weave (PR2+).
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env from the repo root regardless of CWD (api/eval/demo run from backend/).
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    # Secrets (required at call time, optional at import/test time).
    openai_api_key: str | None = None
    wandb_api_key: str | None = None

    # Non-secret config with sensible local defaults.
    openai_model: str = "gpt-4o-2024-08-06"
    redis_url: str = "redis://localhost:6379"
    weave_project: str = "tell"

    # Detector sampling (APR1 — variance reduction). Detectors are *judges*, so
    # they run deterministically (temp 0); that alone lifted same-round label
    # stability 0.775 -> 0.90 on dev. k-sampling added nothing measurable on top of
    # temp 0 (the residual variance is the stochastic speaker, not the judges), so
    # k defaults to 1; the median machinery stays for self-consistency at temp>0
    # (APR4). Detectors may run on a cheaper model than the speaker.
    openai_detector_model: str | None = None  # None -> fall back to openai_model
    detector_samples: int = 1  # k judgments per detector; median suspicion wins
    detector_temperature: float = 0.0


settings = Settings()
