"""FastAPI entrypoint.

PR0 ships only a liveness probe so the scaffold is runnable end to end. The
round, AG-UI streaming, and WebSocket-fallback routes arrive in later PRs.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.agui import router as agui_router

app = FastAPI(title="Tell", version="0.0.0")
app.include_router(agui_router)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe used by the green gate, CI, and `make api`."""
    return {"status": "ok"}
