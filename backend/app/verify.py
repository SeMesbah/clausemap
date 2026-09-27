"""
Quote verification against page text.
"""
from __future__ import annotations

import re
import unicodedata


def normalize(s: str) -> str:
    """Canonical form for substring comparison.

    Steps:
    1. Unicode NFKC
    2. Replace curly quotes and apostrophes with straight ones
    3. Remove hyphen-followed-by-newline (soft line breaks in PDFs)
    4. Collapse all whitespace to single spaces
    5. Lowercase
    """
    s = unicodedata.normalize("NFKC", s)
    # Curly quotes → straight
    s = s.replace("\u2018", "'").replace("\u2019", "'")
    s = s.replace("\u201c", '"').replace("\u201d", '"')
    # Hyphen + line break (PDF line wrapping)
    s = re.sub(r"-\n", "", s)
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s.lower()


def verify_quote(quote: str, page_text: str) -> bool:
    """Return True only if quote has ≥4 words and is found verbatim in page_text.

    Comparison is done after normalize() on both sides so curly/straight quote
    variants and PDF line-break artefacts don't cause false negatives.
    """
    words = quote.split()
    if len(words) < 4:
        return False
    return normalize(quote) in normalize(page_text)
