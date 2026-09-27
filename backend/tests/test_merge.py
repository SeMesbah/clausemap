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
    # The relation quote must name both ends (TechCorp via its alias "the Buyer")
    quote = "Meridian Supplies B.V. (the Supplier) shall deliver goods to the Buyer."
    ext = _ext(
        items=[
            _item("i1", "TechCorp Ltd.", "party",
                  "TechCorp Ltd. (the Buyer) agrees to all terms herein.",
                  aliases=["the Buyer"]),
            _item("i2", "Meridian Supplies B.V.", "party", quote),
        ],
        relations=[
            _rel("i2", "i1", "delivers to", quote),
            _rel("i2", "i1", "delivers to", quote),  # exact duplicate
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


# ---------------------------------------------------------------------------
# 11. An alias declared on a LATER mention still merges (was: first mention only)
# ---------------------------------------------------------------------------

PAGE_LOAN_1 = "Harbourlight Holdings B.V. signed the loan with the shop owner in March."
PAGE_LOAN_2 = (
    "Harbourlight Holdings B.V. is a company in Amsterdam (the Lender). "
    "The Lender may take possession of the Premises."
)


def test_alias_on_later_mention_merges():
    ext1 = _ext(items=[
        _item("i1", "Harbourlight Holdings B.V.", "party",
              "Harbourlight Holdings B.V. signed the loan with the shop owner in March."),
    ])
    ext2 = _ext(items=[
        _item("i1", "Harbourlight Holdings B.V.", "party",
              "Harbourlight Holdings B.V. is a company in Amsterdam (the Lender).",
              aliases=["the Lender"]),
        _item("i2", "Lender", "party",
              "The Lender may take possession of the Premises."),
    ])
    result = build_map([PAGE_LOAN_1, PAGE_LOAN_2], [ext1, ext2], "Test")
    labels = [n.label for n in result.nodes]
    assert labels == ["Harbourlight Holdings B.V."], labels


# ---------------------------------------------------------------------------
# 12. Same label with different types merges; majority type wins
# ---------------------------------------------------------------------------

def test_same_label_different_types_merge():
    page = "The Principal is EUR 48,000 in total. The Borrower shall repay the Principal in full."
    ext = _ext(items=[
        _item("i1", "Principal", "amount", "The Principal is EUR 48,000 in total."),
        _item("i2", "Principal", "amount", "The Borrower shall repay the Principal in full."),
        _item("i3", "the Principal", "topic", "The Principal is EUR 48,000 in total."),
    ])
    result = build_map([page], [ext], "Test")
    assert len(result.nodes) == 1
    assert result.nodes[0].type == "amount"


# ---------------------------------------------------------------------------
# 13. One-word party names join the unique full name; ambiguous ones don't
# ---------------------------------------------------------------------------

def test_short_party_names_merge_when_unambiguous():
    page = (
        "Maarten Hoek came to the shop in the morning. Mr Hoek smiled at them. "
        "Joris Vandermeer drew the maps for years. Ilse Vandermeer read the loan. "
        "Ms Vandermeer said nothing at all."
    )
    ext = _ext(items=[
        _item("i1", "Maarten Hoek", "party", "Maarten Hoek came to the shop in the morning."),
        _item("i2", "Mr Hoek", "party", "Mr Hoek smiled at them."),
        _item("i3", "Joris Vandermeer", "party", "Joris Vandermeer drew the maps for years."),
        _item("i4", "Ilse Vandermeer", "party", "Ilse Vandermeer read the loan."),
        _item("i5", "Ms Vandermeer", "party", "Ms Vandermeer said nothing at all."),
    ])
    result = build_map([page], [ext], "Test")
    labels = sorted(n.label for n in result.nodes)
    # Hoek merges into Maarten Hoek; "Ms Vandermeer" matches two people, stays apart
    assert labels == ["Ilse Vandermeer", "Joris Vandermeer", "Maarten Hoek", "Ms Vandermeer"], labels


# ---------------------------------------------------------------------------
# 14. A relation whose quote doesn't name one of its ends is dropped
# ---------------------------------------------------------------------------

def test_relation_quote_must_name_both_ends():
    page = (
        "Harbourlight wants to build a resort on the dunes. "
        "It says the shop shall pay the apprentice under the apprenticeship contract."
    )
    ext = _ext(
        items=[
            _item("i1", "Harbourlight", "party", "Harbourlight wants to build a resort on the dunes."),
            _item("i2", "apprenticeship contract", "topic",
                  "It says the shop shall pay the apprentice under the apprenticeship contract."),
        ],
        relations=[
            # Mis-wired by the model: the quote is real but never mentions the contract
            _rel("i1", "i2", "wants to build", "Harbourlight wants to build a resort on the dunes."),
        ],
    )
    result = build_map([page], [ext], "Test")
    assert result.edges == []


# ---------------------------------------------------------------------------
# 15. An alias claimed by two different parties merges nothing
#     (regression: "the Borrower" on Joris AND Ilse collapsed people together)
# ---------------------------------------------------------------------------

def test_alias_claimed_twice_does_not_chain():
    page = (
        "Joris Vandermeer signed as the Borrower in March. "
        "Ilse Vandermeer is now the Borrower under clause 10. "
        "The Borrower shall repay the Principal in full."
    )
    ext = _ext(items=[
        _item("i1", "Joris Vandermeer", "party",
              "Joris Vandermeer signed as the Borrower in March.", aliases=["the Borrower"]),
        _item("i2", "Ilse Vandermeer", "party",
              "Ilse Vandermeer is now the Borrower under clause 10.", aliases=["the Borrower"]),
        _item("i3", "Borrower", "party", "The Borrower shall repay the Principal in full."),
    ])
    result = build_map([page], [ext], "Test")
    labels = sorted(n.label for n in result.nodes)
    assert labels == ["Borrower", "Ilse Vandermeer", "Joris Vandermeer"], labels


# ---------------------------------------------------------------------------
# 16. A wrong alias can't absorb an entity that already has a proper name
#     (regression: "Harbourlight" aka "the Municipality" swallowed the
#     Municipality of Harlingerzijl)
# ---------------------------------------------------------------------------

def test_alias_does_not_absorb_named_entity():
    page = (
        "The Municipality of Harlingerzijl shall accept the Survey. "
        "Harbourlight could take the shop if the Municipality declined. "
        "The Municipality is a partner in the project."
    )
    ext = _ext(items=[
        _item("i1", "Municipality of Harlingerzijl", "party",
              "The Municipality of Harlingerzijl shall accept the Survey."),
        _item("i2", "Harbourlight", "party",
              "Harbourlight could take the shop if the Municipality declined.",
              aliases=["the Municipality"]),
        _item("i3", "the Municipality", "party", "The Municipality is a partner in the project."),
    ])
    result = build_map([page], [ext], "Test")
    labels = sorted(n.label for n in result.nodes)
    assert labels == ["Harbourlight", "Municipality of Harlingerzijl"], labels


# ---------------------------------------------------------------------------
# 17. One malformed item doesn't throw away the rest of the page
# ---------------------------------------------------------------------------

def test_malformed_item_keeps_rest_of_page():
    from app.extract import _parse_lenient
    ext = _parse_lenient({
        "items": [
            {"local_id": "1", "label": "Water Board", "type": "party", "aliases": []},  # no quote
            {"local_id": "2", "label": "Anneke Bos", "type": "party", "aliases": [],
             "quote": "I keep this dike for Waterschap Noorderzand."},
        ],
        "relations": [],
    })
    assert [i.label for i in ext.items] == ["Anneke Bos"]
    assert not ext.failed


# ---------------------------------------------------------------------------
# 18. One stray alias tag is outvoted by the entity that declares it most
# ---------------------------------------------------------------------------

def test_alias_majority_outvotes_stray_tag():
    pages = [
        "Harbourlight Holdings B.V. is the Lender under this loan.",
        "Harbourlight Holdings B.V. as the Lender signed the letter.",
        "Harbourlight Holdings B.V. the Lender confirmed receipt of payment.",
        "Maarten Hoek spoke for the Lender at the meeting.",
        "The Lender shall release all security over the Premises.",
    ]
    exts = [
        _ext(items=[_item("i1", "Harbourlight Holdings B.V.", "party", pages[0], aliases=["the Lender"])]),
        _ext(items=[_item("i1", "Harbourlight Holdings B.V.", "party", pages[1], aliases=["the Lender"])]),
        _ext(items=[_item("i1", "Harbourlight Holdings B.V.", "party", pages[2], aliases=["the Lender"])]),
        _ext(items=[_item("i1", "Maarten Hoek", "party", pages[3], aliases=["the Lender"])]),
        _ext(items=[_item("i1", "Lender", "party", pages[4])]),
    ]
    result = build_map(pages, exts, "Test")
    labels = sorted(n.label for n in result.nodes)
    assert labels == ["Harbourlight Holdings B.V.", "Maarten Hoek"], labels
