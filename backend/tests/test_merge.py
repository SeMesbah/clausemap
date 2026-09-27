"""
Tests for app.merge — build_map().

Covers every required case from the plan:
  - "Acme Holdings Inc." and "Acme Holdings" merge
  - "Acme Holdings Inc." with alias "the Company" merges with an item labelled "the Company"
  - An item with an unverifiable quote is dropped and counted
  - No output edge points to a missing node
  - [WARGAME] "Acme Holdings Inc." and "Acme Holdings Ltd." stay two nodes
  - [WARGAME] "Acme Holdings" merges with "Acme Holdings Inc." when it's the only suffixed match
  - [WARGAME] Two parties that each carry the alias "Party" stay two nodes
  - Evidence cap: at most 10 items per node
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.extract import PageExtraction, PageItem, PageRelation
from app.merge import build_map


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _item(local_id: str, label: str, itype: str, quote: str, aliases=None) -> PageItem:
    return PageItem(
        local_id=local_id,
        label=label,
        type=itype,
        aliases=aliases or [],
        quote=quote,
    )


def _rel(src: str, tgt: str, relation: str, quote: str) -> PageRelation:
    return PageRelation(
        source_local_id=src,
        target_local_id=tgt,
        relation=relation,
        quote=quote,
    )


def _ext(items=None, relations=None) -> PageExtraction:
    return PageExtraction(items=items or [], relations=relations or [])


# Page texts used in tests — quotes must appear verbatim for verify_quote to pass
PAGE_ACME = (
    "Acme Holdings Inc. (hereinafter the Company) agrees to pay by the end of the term. "
    "Acme Holdings shall deliver goods on time. "
    "Acme Holdings Ltd. agrees to the same terms. "
    "The Supplier shall deliver quarterly reports to the Buyer no later than thirty days. "
    "Each party herein is bound by the provisions below."
)

PAGE_BUYER_SUPPLIER = (
    "TechCorp Ltd. (the Buyer) agrees to all terms herein. "
    "Meridian Supplies B.V. (the Supplier) shall deliver goods to the Buyer. "
    "Each Party agrees to maintain confidentiality of all shared information."
)


# ---------------------------------------------------------------------------
# 1. "Acme Holdings Inc." and "Acme Holdings" merge
# ---------------------------------------------------------------------------

def test_acme_inc_and_bare_merge():
    page = PAGE_ACME
    ext = _ext(items=[
        _item("i1", "Acme Holdings Inc.", "party",
              "Acme Holdings Inc. (hereinafter the Company) agrees to pay by the end of the term."),
        _item("i2", "Acme Holdings", "party",
              "Acme Holdings shall deliver goods on time."),
    ])
    result = build_map([page], [ext], "Test")
    party_nodes = [n for n in result.nodes if n.type == "party"]
    assert len(party_nodes) == 1, f"Expected 1 party node, got {len(party_nodes)}: {[n.label for n in party_nodes]}"


# ---------------------------------------------------------------------------
# 2. "Acme Holdings Inc." with alias "the Company" merges with "the Company"
# ---------------------------------------------------------------------------

def test_alias_merge_the_company():
    page = PAGE_ACME
    ext = _ext(items=[
        _item("i1", "Acme Holdings Inc.", "party",
              "Acme Holdings Inc. (hereinafter the Company) agrees to pay by the end of the term.",
              aliases=["the Company"]),
        _item("i2", "the Company", "party",
              "Acme Holdings shall deliver goods on time."),
    ])
    result = build_map([page], [ext], "Test")
    party_nodes = [n for n in result.nodes if n.type == "party"]
    assert len(party_nodes) == 1, f"Expected 1 party node, got {len(party_nodes)}: {[n.label for n in party_nodes]}"


# ---------------------------------------------------------------------------
# 3. Item with unverifiable quote is dropped and counted
# ---------------------------------------------------------------------------

def test_unverifiable_quote_dropped():
    page = PAGE_ACME
    ext = _ext(items=[
        _item("i1", "Acme Holdings Inc.", "party",
              "Acme Holdings Inc. (hereinafter the Company) agrees to pay by the end of the term."),
        _item("i2", "Some Other Party", "party",
              "This sentence does not appear in the page text at all and will fail verification."),
    ])
    result = build_map([page], [ext], "Test")
    # One item dropped
    assert result.stats.items_dropped_unverified == 1
    # Only the verified item appears
    assert len(result.nodes) == 1
    assert result.nodes[0].label == "Acme Holdings Inc."


# ---------------------------------------------------------------------------
# 4. No output edge points to a missing node
# ---------------------------------------------------------------------------

def test_no_dangling_edges():
    page = PAGE_ACME
    # i3 has a bad quote → dropped → its edges must be dropped too
    ext = _ext(
        items=[
            _item("i1", "Acme Holdings Inc.", "party",
                  "Acme Holdings Inc. (hereinafter the Company) agrees to pay by the end of the term."),
            _item("i3", "Phantom Party", "party",
                  "This invented sentence is not present in the page text at all."),
        ],
        relations=[
            _rel("i1", "i3", "pays",
                 "Acme Holdings Inc. (hereinafter the Company) agrees to pay by the end of the term."),
        ],
    )
    result = build_map([page], [ext], "Test")
    node_ids = {n.id for n in result.nodes}
    for edge in result.edges:
        assert edge.source in node_ids, f"Dangling source: {edge.source}"
        assert edge.target in node_ids, f"Dangling target: {edge.target}"


# ---------------------------------------------------------------------------
# 5. [WARGAME] "Acme Holdings Inc." and "Acme Holdings Ltd." stay two nodes
# ---------------------------------------------------------------------------

def test_different_suffixes_stay_separate():
    page = PAGE_ACME
    ext = _ext(items=[
        _item("i1", "Acme Holdings Inc.", "party",
              "Acme Holdings Inc. (hereinafter the Company) agrees to pay by the end of the term."),
        _item("i2", "Acme Holdings Ltd.", "party",
              "Acme Holdings Ltd. agrees to the same terms."),
    ])
    result = build_map([page], [ext], "Test")
    party_nodes = [n for n in result.nodes if n.type == "party"]
    assert len(party_nodes) == 2, (
        f"Expected 2 party nodes (different suffixes), got {len(party_nodes)}: "
        f"{[n.label for n in party_nodes]}"
    )


# ---------------------------------------------------------------------------
# 6. [WARGAME] "Acme Holdings" merges with "Acme Holdings Inc." (no suffix vs. one suffix)
# ---------------------------------------------------------------------------

def test_no_suffix_merges_with_single_suffixed():
    page = PAGE_ACME
    ext = _ext(items=[
        _item("i1", "Acme Holdings Inc.", "party",
              "Acme Holdings Inc. (hereinafter the Company) agrees to pay by the end of the term."),
        _item("i2", "Acme Holdings", "party",
              "Acme Holdings shall deliver goods on time."),
    ])
    result = build_map([page], [ext], "Test")
    party_nodes = [n for n in result.nodes if n.type == "party"]
    assert len(party_nodes) == 1, (
        f"Expected 1 party node (no-suffix merges with suffixed), got {len(party_nodes)}: "
        f"{[n.label for n in party_nodes]}"
    )


# ---------------------------------------------------------------------------
# 7. [WARGAME] Two parties each carrying alias "Party" stay two nodes
# ---------------------------------------------------------------------------

def test_ambiguous_alias_prevents_merge():
    page = PAGE_BUYER_SUPPLIER
    ext = _ext(items=[
        _item("i1", "TechCorp Ltd.", "party",
              "TechCorp Ltd. (the Buyer) agrees to all terms herein.",
              aliases=["the Buyer", "Party"]),
        _item("i2", "Meridian Supplies B.V.", "party",
              "Meridian Supplies B.V. (the Supplier) shall deliver goods to the Buyer.",
              aliases=["the Supplier", "Party"]),
    ])
    result = build_map([page], [ext], "Test")
    party_nodes = [n for n in result.nodes if n.type == "party"]
    assert len(party_nodes) == 2, (
        f"Expected 2 party nodes (ambiguous alias 'Party'), got {len(party_nodes)}: "
        f"{[n.label for n in party_nodes]}"
    )


# ---------------------------------------------------------------------------
# 8. Evidence cap: node evidence is capped at 10 items
# ---------------------------------------------------------------------------

def test_evidence_cap():
    # Build a page text that contains 15 distinct verifiable sentences
    sentences = [
        f"The Company shall perform obligation number {i} as required under this Agreement." 
        for i in range(1, 16)
    ]
    page = " ".join(sentences)
    items = [
        _item(f"i{i}", "The Company", "party", sentences[i - 1])
        for i in range(1, 16)
    ]
    ext = _ext(items=items)
    result = build_map([page], [ext], "Test")
    assert len(result.nodes) == 1
    assert len(result.nodes[0].evidence) <= 10, (
        f"Evidence not capped: got {len(result.nodes[0].evidence)} items"
    )


# ---------------------------------------------------------------------------
# 9. Duplicate edges (same src, tgt, relation) are merged into one
# ---------------------------------------------------------------------------

def test_duplicate_edges_merged():
    page = PAGE_BUYER_SUPPLIER
    quote = "TechCorp Ltd. (the Buyer) agrees to all terms herein."
    ext = _ext(
        items=[
            _item("i1", "TechCorp Ltd.", "party", quote),
            _item("i2", "Meridian Supplies B.V.", "party",
                  "Meridian Supplies B.V. (the Supplier) shall deliver goods to the Buyer."),
        ],
        relations=[
            _rel("i1", "i2", "pays", quote),
            _rel("i1", "i2", "pays", quote),  # exact duplicate
        ],
    )
    result = build_map([page], [ext], "Test")
    # Duplicate relation should be collapsed to one edge
    assert len(result.edges) == 1


# ---------------------------------------------------------------------------
# 10. Stats are populated correctly
# ---------------------------------------------------------------------------

def test_stats_populated():
    page = PAGE_ACME
    ext = _ext(items=[
        _item("i1", "Acme Holdings Inc.", "party",
              "Acme Holdings Inc. (hereinafter the Company) agrees to pay by the end of the term."),
        _item("i2", "Bad item", "party",
              "Completely invented sentence that will not match any page text."),
    ])
    result = build_map([page], [ext], "Test")
    assert result.stats.pages == 1
    assert result.stats.items_dropped_unverified == 1
    assert result.stats.nodes == 1
    assert result.stats.duration_ms >= 0
