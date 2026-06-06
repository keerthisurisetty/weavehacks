"""FastAPI entrypoint.

PR0 ships only a liveness probe so the scaffold is runnable end to end. The
round, AG-UI streaming, and WebSocket-fallback routes arrive in later PRs.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.agui import router as agui_router
from app.config import settings
from app.llm import init_weave

log = logging.getLogger("tell")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Start Weave at boot so rounds run from the UI also trace to Weave.

    Guarded by a W&B key and wrapped so tracing can never crash the API. The test
    suite stubs init_weave (tests/conftest.py) to keep the green gate offline.
    """
    if settings.wandb_api_key:
        try:
            init_weave()
            log.info("Weave tracing on (project=%s)", settings.weave_project)
        except Exception:
            log.warning("Weave init failed; serving without tracing", exc_info=True)
    yield


app = FastAPI(title="Tell", version="0.0.0", lifespan=lifespan)
app.include_router(agui_router)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe used by the green gate, CI, and `make api`."""
    return {"status": "ok"}
