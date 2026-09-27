"""
Full pipeline: bytes → MapResult.
"""
from __future__ import annotations

import time

from app.errors import LLMUnavailableError
from app.extract import extract_all
from app.merge import build_map
from app.pdf import extract_pages
from app.schemas import MapResult

# OpenAI error types used to detect auth/quota failures
_LLM_AUTH_ERRORS: tuple[type, ...] = ()
try:
    from openai import AuthenticationError, PermissionDeniedError, RateLimitError
    _LLM_AUTH_ERRORS = (AuthenticationError, PermissionDeniedError, RateLimitError)
except ImportError:
    pass


async def run_pipeline(data: bytes, title: str) -> MapResult:
    """Extract pages, run LLM extraction on all of them, merge into a MapResult.

    Raises LLMUnavailableError when every page fails due to an auth / quota issue.
    Adds a warning for every page that returned an empty extraction.
    """
    t0 = time.perf_counter()
    pages = extract_pages(data)

    try:
        extractions = await extract_all(pages)
    except Exception as exc:
        if _LLM_AUTH_ERRORS and isinstance(exc, _LLM_AUTH_ERRORS):
            raise LLMUnavailableError("LLM auth/quota failure") from exc
        raise

    # If every page produced an empty extraction, check whether it looks like
    # an LLM auth/quota problem vs. a content problem.
    text_pages = [p for p in pages if p.strip()]
    all_failed = all(e.failed for e in extractions)
    if text_pages and all_failed:
        # Treat as LLM unavailable — the caller will surface a clear 503.
        raise LLMUnavailableError("All pages returned empty extractions")

    # Detect failed pages: empty extraction on a page that had text
    failed: list[int] = []
    for i, (page_text, ext) in enumerate(zip(pages, extractions)):
        if page_text.strip() and ext.failed:
            failed.append(i + 1)  # 1-based

    result = build_map(pages, extractions, title)

    # Ensure the pipeline-level failed-page warnings are present
    existing_warnings = set(result.warnings)
    extra_warnings = [
        f"Page {fp} couldn't be read and was skipped"
        for fp in failed
        if f"Page {fp} couldn't be read and was skipped" not in existing_warnings
    ]
    if extra_warnings:
        result = result.model_copy(
            update={"warnings": list(result.warnings) + extra_warnings}
        )

    # build_map only times the merge; report the whole run, LLM calls included.
    duration_ms = int((time.perf_counter() - t0) * 1000)
    return result.model_copy(
        update={"stats": result.stats.model_copy(update={"duration_ms": duration_ms})}
    )
