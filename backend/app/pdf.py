"""
PDF text extraction.
"""
from __future__ import annotations

import io


def extract_pages(data: bytes) -> list[str]:
    """Return one string per page (index 0 = page 1, 1-based order preserved).

    Raises:
        ValueError("no_text_layer")  — total extracted text < 200 characters.
        ValueError("too_many_pages") — page count > 30.
    """
    try:
        from pypdf import PdfReader
    except ImportError:
        raise RuntimeError("pypdf is not installed; add it to requirements.txt")

    reader = PdfReader(io.BytesIO(data))

    if len(reader.pages) > 30:
        raise ValueError("too_many_pages")

    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)

    total_chars = sum(len(t) for t in pages)
    if total_chars < 200:
        raise ValueError("no_text_layer")

    return pages
