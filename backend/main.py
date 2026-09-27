"""
Clausemap API — application entry point.

Start with:
    uvicorn main:app --reload          (from backend/)
    uvicorn app.main:app --reload      (from repo root)
"""
from __future__ import annotations

import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.router import router

# ---------------------------------------------------------------------------
# Logging — structured, no document text
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("clausemap.access")


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Clausemap API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],  # no PUT/DELETE/PATCH on this surface
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Access-log middleware — method, path, status, duration (no body, no text)
# ---------------------------------------------------------------------------

@app.middleware("http")
async def _access_log(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    duration_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        "method=%s path=%s status=%d duration_ms=%d",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ---------------------------------------------------------------------------
# Mount router
# ---------------------------------------------------------------------------

app.include_router(router, prefix="/api/v1")
