"""
API routes for Clausemap v1.

Endpoints:
  POST /maps          — upload a PDF, return MapResult
  GET  /demo/{id}     — serve a cached MapResult
  GET  /health        — liveness probe  (mounted at /api/v1 in main.py)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter, Request, UploadFile
from fastapi.responses import JSONResponse

from app.errors import LLMUnavailableError
from app.pipeline import run_pipeline
from app.pdf import extract_pages

logger = logging.getLogger("clausemap.api")

router = APIRouter()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MAX_BYTES = 10 * 1024 * 1024          # 10 MB
_PIPELINE_TIMEOUT = 120                 # seconds
_PDF_PARSE_TIMEOUT = 20                 # seconds
_ALLOWED_DEMOS = {"demo-1", "demo-2"}
_CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"

# ---------------------------------------------------------------------------
# Global pipeline semaphore — cap parallel LLM spend / memory
# ---------------------------------------------------------------------------
_PIPELINE_SEM = asyncio.Semaphore(2)

# ---------------------------------------------------------------------------
# Per-IP rate limiter (in-memory, per-instance)
# Rate: 5 requests per 600 seconds
# ---------------------------------------------------------------------------
_RATE_WINDOW = 600          # seconds
_RATE_LIMIT = 5             # max requests per window

# { ip: [(timestamp, ...), ...] }
_rate_store: dict[str, list[float]] = defaultdict(list)


def _get_client_ip(request: Request) -> str:
    """Return the rightmost X-Forwarded-For entry (hardest to spoof), or socket IP."""
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[-1].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _check_rate_limit(ip: str) -> bool:
    """Return True if the request is allowed, False if rate-limited."""
    now = time.time()
    window_start = now - _RATE_WINDOW
    timestamps = _rate_store[ip]
    # Drop expired entries
    _rate_store[ip] = [t for t in timestamps if t >= window_start]
    if len(_rate_store[ip]) >= _RATE_LIMIT:
        return False
    _rate_store[ip].append(now)
    return True


# ---------------------------------------------------------------------------
# Error helpers
# ---------------------------------------------------------------------------

def _err(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message}},
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/maps")
async def upload_map(request: Request, file: UploadFile):
    t0 = time.perf_counter()
    ip = _get_client_ip(request)

    # --- Rate limit ---------------------------------------------------------
    if not _check_rate_limit(ip):
        return _err(
            "rate_limited",
            "Too many documents in a short time. Try again in a few minutes.",
            429,
        )

    # --- Global concurrency cap ---------------------------------------------
    if not _PIPELINE_SEM._value:  # non-blocking peek
        return _err(
            "busy",
            "Clausemap is busy with other documents. Try again in a minute, or open a demo.",
            429,
        )

    # --- Read upload (max 10 MB + 1 byte probe) ------------------------------
    try:
        data = await file.read(_MAX_BYTES + 1)
    finally:
        await file.close()

    if len(data) > _MAX_BYTES:
        logger.info("upload rejected: file_too_large ip=%s", ip)
        return _err("file_too_large", "Files up to 10 MB are supported.", 413)

    # --- Magic-byte check ---------------------------------------------------
    if not data.startswith(b"%PDF-"):
        logger.info("upload rejected: not_a_pdf ip=%s", ip)
        return _err("not_a_pdf", "That doesn't look like a PDF file.", 400)

    # --- Parse PDF in a thread (keeps event loop free) ----------------------
    title = (file.filename or "document").rsplit(".", 1)[0]

    try:
        pages = await asyncio.wait_for(
            asyncio.to_thread(extract_pages, data),
            timeout=_PDF_PARSE_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.warning("pdf parse timed out ip=%s", ip)
        return _err(
            "unreadable_pdf",
            "This PDF couldn't be read. Try another file.",
            422,
        )
    except ValueError as exc:
        code = str(exc)
        if code == "no_text_layer":
            return _err(
                "no_text_layer",
                "This looks like a scan, so there's no text to read. Text-based PDFs only for now.",
                422,
            )
        if code == "too_many_pages":
            return _err("too_many_pages", "Up to 30 pages for now.", 422)
        logger.warning("pdf parse error ip=%s code=%s", ip, code)
        return _err("unreadable_pdf", "This PDF couldn't be read. Try another file.", 422)

    page_count = len(pages)

    # --- Run pipeline under semaphore + timeout -----------------------------
    try:
        async with _PIPELINE_SEM:
            result = await asyncio.wait_for(
                run_pipeline(data, title),
                timeout=_PIPELINE_TIMEOUT,
            )
    except asyncio.TimeoutError:
        logger.warning("pipeline timeout ip=%s pages=%d", ip, page_count)
        return _err(
            "timeout",
            "Processing took too long. Try a shorter document.",
            504,
        )
    except LLMUnavailableError:
        logger.error("llm unavailable ip=%s", ip)
        return _err(
            "llm_unavailable",
            "Live mapping is unavailable right now. The demos still work.",
            503,
        )
    except Exception as exc:
        logger.error("pipeline error type=%s ip=%s", type(exc).__name__, ip)
        return _err("internal_error", "Something went wrong. Try again shortly.", 500)

    duration_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        "maps status=200 ip=%s pages=%d nodes=%d edges=%d duration_ms=%d",
        ip, page_count, result.stats.nodes, result.stats.edges, duration_ms,
    )
    return result


@router.get("/demo/{demo_id}")
async def get_demo(demo_id: str):
    if demo_id not in _ALLOWED_DEMOS:
        return _err("not_found", f"No demo named '{demo_id}'.", 404)

    cache_file = _CACHE_DIR / f"{demo_id}.json"
    if not cache_file.exists():
        return _err(
            "not_found",
            f"Demo '{demo_id}' is not ready yet.",
            404,
        )

    return JSONResponse(content=json.loads(cache_file.read_text()))


