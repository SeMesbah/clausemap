#!/usr/bin/env python
"""
run_local.py — offline CLI for Clausemap pipeline.

Usage:
    python scripts/run_local.py <pdf> --stage extract
    python scripts/run_local.py <pdf> --stage map   (added in Phase A2)

Outputs go to  backend/out/<pdf-stem>.<stage>.json
"""
from __future__ import annotations

import argparse
import asyncio
import collections
import json
import os
import sys
import time
from pathlib import Path

# Make sure backend/ is on sys.path when run from the repo root or backend/
_HERE = Path(__file__).resolve().parent
_BACKEND = _HERE.parent
sys.path.insert(0, str(_BACKEND))

from dotenv import load_dotenv

load_dotenv(_BACKEND / ".env")

from app.pdf import extract_pages
from app.extract import extract_all, PageExtraction
from app.verify import verify_quote


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _out_dir() -> Path:
    d = _BACKEND / "out"
    d.mkdir(exist_ok=True)
    return d


def _summarise_extractions(
    pages: list[str],
    extractions: list[PageExtraction],
) -> None:
    """Print a human-readable summary and quote-verification stats."""
    type_counts: dict[str, int] = collections.defaultdict(int)
    relation_count = 0
    failed_pages: list[int] = []
    total_items = 0
    verified_items = 0

    for i, (page_text, ext) in enumerate(zip(pages, extractions), start=1):
        if not ext.items and not ext.relations:
            failed_pages.append(i)
            continue
        for item in ext.items:
            type_counts[item.type] += 1
            total_items += 1
            if verify_quote(item.quote, page_text):
                verified_items += 1
        relation_count += len(ext.relations)

    print(f"\n  Pages read:     {len(pages)}")
    for t in ["party", "obligation", "date", "amount", "topic"]:
        if type_counts[t]:
            print(f"  {t.capitalize():12s}: {type_counts[t]}")
    print(f"  Relations:      {relation_count}")
    if failed_pages:
        print(f"  Failed pages:   {failed_pages}")
    else:
        print("  Failed pages:   none")
    if total_items:
        pct = int(100 * verified_items / total_items)
        print(f"  Quotes verified: {pct}% ({verified_items}/{total_items})")


# ---------------------------------------------------------------------------
# Stages
# ---------------------------------------------------------------------------

async def _stage_extract(pdf_path: Path) -> None:
    print(f"\n[extract] {pdf_path.name}")
    t0 = time.perf_counter()

    data = pdf_path.read_bytes()
    pages = extract_pages(data)
    print(f"  PDF read: {len(pages)} pages")

    extractions = await extract_all(pages)

    elapsed = time.perf_counter() - t0
    print(f"  Extraction done in {elapsed:.1f}s")

    _summarise_extractions(pages, extractions)

    out_path = _out_dir() / f"{pdf_path.stem}.extract.json"
    payload = [e.model_dump() for e in extractions]
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\n  Written → {out_path.relative_to(_BACKEND)}")


async def _stage_map(pdf_path: Path) -> None:
    # Implemented in Phase A2
    print("[map] stage not yet implemented — come back in Phase A2.")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Clausemap local pipeline runner")
    parser.add_argument("pdf", help="Path to a PDF file")
    parser.add_argument(
        "--stage",
        choices=["extract", "map"],
        default="extract",
        help="Pipeline stage to run (default: extract)",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf).resolve()
    if not pdf_path.exists():
        print(f"Error: file not found: {pdf_path}")
        sys.exit(1)

    if args.stage == "extract":
        asyncio.run(_stage_extract(pdf_path))
    elif args.stage == "map":
        asyncio.run(_stage_map(pdf_path))


if __name__ == "__main__":
    main()
