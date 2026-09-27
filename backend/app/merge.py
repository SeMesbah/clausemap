"""
Merging and graph assembly.

build_map(pages, extractions, title) -> MapResult

Steps:
  1. Drop items/relations whose quotes fail verify_quote.
  2. Compute a merge key per item.
  3. Merge items by key or by label/alias cross-match.
  4. Assign stable ids, repoint relations, drop dangling edges, dedup edges.
  5. Set mentions = evidence count per node (capped at 10).
  6. Fill stats and steps.
"""
from __future__ import annotations

import re
import string
import time
from collections import defaultdict
from typing import NamedTuple

from app.extract import PageExtraction, PageItem, PageRelation
from app.schemas import DocumentInfo, Edge, Evidence, MapResult, Node, Stats, Step
from app.verify import normalize, verify_quote

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_COMPANY_SUFFIXES = {"inc", "ltd", "llc", "gmbh", "bv", "plc", "corp", "corporation"}

# Normalise "b.v." → "bv" etc. when checking suffix presence
_SUFFIX_DOTS = {"inc.", "b.v.", "corp."}

# Aliases that are so generic they must never be used for merging
_ALIAS_STOPLIST = {
    "party", "parties", "the parties", "agreement", "this agreement",
    "affiliate", "affiliates", "person", "persons", "third party",
}

_MAX_EVIDENCE = 10  # cap per node and per edge


# ---------------------------------------------------------------------------
# Merge-key helpers
# ---------------------------------------------------------------------------

def _strip_punct(s: str) -> str:
    return s.translate(str.maketrans("", "", string.punctuation))


def _label_core(label: str) -> str:
    """Normalised label with leading 'the', punctuation and whitespace removed."""
    s = normalize(label)
    s = _strip_punct(s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"^the\s+", "", s)
    return s


def _has_company_suffix(core: str) -> str | None:
    """Return the suffix token if the last word is a known company suffix, else None."""
    words = core.split()
    if not words:
        return None
    last = words[-1].rstrip(".")
    if last in _COMPANY_SUFFIXES:
        return last
    return None


def _core_without_suffix(core: str) -> str:
    """Return core with the trailing company suffix removed, if present."""
    words = core.split()
    if words and words[-1].rstrip(".") in _COMPANY_SUFFIXES:
        return " ".join(words[:-1])
    return core


def _merge_key(item_type: str, label: str) -> str:
    """Primary merge key: type + full normalised label core (suffix kept).

    Keeping the suffix in the key means "Acme Holdings Inc." and
    "Acme Holdings Ltd." land in separate primary buckets and are only
    merged in the union-find cross-match pass — which enforces the
    suffix-compatibility rule.  "Acme Holdings" (no suffix) gets its own
    bucket and is merged with Inc. via the cross-match.
    """
    return f"{item_type}|{_label_core(label)}"


# ---------------------------------------------------------------------------
# Alias filtering
# ---------------------------------------------------------------------------

def _safe_aliases(aliases: list[str]) -> list[str]:
    """Remove stoplist aliases."""
    return [a for a in aliases if normalize(a) not in _ALIAS_STOPLIST]


# ---------------------------------------------------------------------------
# Merged-item accumulator
# ---------------------------------------------------------------------------

class _MergedItem(NamedTuple):
    item_type: str
    canonical_label: str
    aliases: list[str]
    evidence: list[tuple[int, str]]  # (page, quote) pairs, capped later


# ---------------------------------------------------------------------------
# build_map
# ---------------------------------------------------------------------------

def build_map(
    pages: list[str],
    extractions: list[PageExtraction],
    title: str,
) -> MapResult:
    t_start = time.perf_counter()
    steps: list[dict] = []

    def _ms() -> int:
        return int((time.perf_counter() - t_start) * 1000)

    steps.append({"t_ms": _ms(), "message": f"Read {len(pages)} pages"})

    # -----------------------------------------------------------------------
    # 1. Collect all items and relations; verify quotes
    # -----------------------------------------------------------------------
    raw_items: list[tuple[int, PageItem]] = []      # (page_number, item)
    raw_relations: list[tuple[int, PageRelation]] = []  # (page_number, relation)
    dropped = 0
    failed_pages: list[int] = []

    for page_idx, ext in enumerate(extractions):
        page_num = page_idx + 1
        page_text = pages[page_idx] if page_idx < len(pages) else ""

        if not ext.items and not ext.relations:
            failed_pages.append(page_num)
            continue

        for item in ext.items:
            if verify_quote(item.quote, page_text):
                raw_items.append((page_num, item))
            else:
                dropped += 1

        for rel in ext.relations:
            if verify_quote(rel.quote, page_text):
                raw_relations.append((page_num, rel))
            else:
                dropped += 1

    total_raw = len(raw_items)
    steps.append({"t_ms": _ms(), "message": f"Found {total_raw} items ({dropped} dropped: quotes not verified)"})

    # -----------------------------------------------------------------------
    # 2 & 3. Merge items
    #
    # Strategy:
    #   a) Assign each item a primary key = type + label-core-without-suffix.
    #   b) First pass: group by primary key → cluster list.
    #   c) Second pass: also merge clusters where one's label or safe alias
    #      equals another's label or safe alias after normalisation.
    #      BUT: two items whose labels BOTH have company suffixes, and the
    #      suffixes differ, are never merged.
    # -----------------------------------------------------------------------

    # cluster: list of (page_num, item)
    clusters: list[list[tuple[int, PageItem]]] = []
    key_to_cluster: dict[str, int] = {}   # primary key → cluster index

    for page_num, item in raw_items:
        key = _merge_key(item.type, item.label)
        if key in key_to_cluster:
            clusters[key_to_cluster[key]].append((page_num, item))
        else:
            idx = len(clusters)
            clusters.append([(page_num, item)])
            key_to_cluster[key] = idx

    # Build a map: (type, normalised-name) → cluster index for alias cross-match
    # "name" = any of label or safe aliases, after _label_core
    name_to_cluster: dict[tuple[str, str], int] = {}

    def _register_names(cluster_idx: int, item_type: str, label: str, aliases: list[str]) -> None:
        for name in [label] + aliases:
            n = _label_core(name)
            if not n:
                continue
            full_key = (item_type, n)
            # First-seen wins: keep the earliest cluster's registration so that
            # a suffixed label (registered first) isn't overwritten by a bare
            # label that happens to share the same normalised core.
            if full_key not in name_to_cluster:
                name_to_cluster[full_key] = cluster_idx
            # Also register the suffix-stripped version so a bare label
            # ("Acme Holdings") can locate this cluster ("Acme Holdings Inc.")
            n_stripped = _core_without_suffix(n)
            if n_stripped != n:
                stripped_key = (item_type, n_stripped)
                if stripped_key not in name_to_cluster:
                    name_to_cluster[stripped_key] = cluster_idx

    for idx, cluster in enumerate(clusters):
        page_num, first = cluster[0]
        safe = _safe_aliases(first.aliases)
        _register_names(idx, first.type, first.label, safe)

    # Cross-merge: for each item, look up its names in existing clusters
    # Collect merge pairs, then union-find to merge transitively
    parent = list(range(len(clusters)))

    def _find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def _union(a: int, b: int) -> None:
        ra, rb = _find(a), _find(b)
        if ra != rb:
            parent[rb] = ra

    for idx, cluster in enumerate(clusters):
        page_num, first = cluster[0]
        core_first = _label_core(first.label)
        suffix_first = _has_company_suffix(core_first)
        safe = _safe_aliases(first.aliases)

        for name in [first.label] + safe:
            n = _label_core(name)
            key = (first.type, n)
            if key in name_to_cluster:
                other_idx = name_to_cluster[key]
                if other_idx == idx:
                    continue
                # Suffix guard: two labels both with suffixes → only merge if suffixes match
                _, other_first = clusters[other_idx][0]
                core_other = _label_core(other_first.label)
                suffix_other = _has_company_suffix(core_other)
                if suffix_first and suffix_other and suffix_first != suffix_other:
                    continue
                _union(idx, other_idx)

    # Group clusters by root
    root_to_members: dict[int, list[int]] = defaultdict(list)
    for idx in range(len(clusters)):
        root_to_members[_find(idx)].append(idx)

    # Build final merged items
    # canonical label = label of the item with the most evidence in the group
    merged: list[dict] = []  # {type, label, aliases, evidence: [(page, quote)]}

    # Also build a map: original (page_num, local_id) → merged node index
    item_key_to_node: dict[tuple[int, str], int] = {}

    # Map from cluster index to merged node index
    cluster_to_node: dict[int, int] = {}

    # Collect alias → [labels] to detect ambiguous aliases
    alias_label_map: dict[str, set[str]] = defaultdict(set)
    for cluster in clusters:
        for _, item in cluster:
            core_label = _label_core(item.label)
            for a in _safe_aliases(item.aliases):
                alias_label_map[_label_core(a)].add(core_label)

    # Ambiguous alias = one that appears across 2+ different canonical labels
    ambiguous_aliases: set[str] = {
        a for a, labels in alias_label_map.items() if len(labels) >= 2
    }

    for root, member_idxs in root_to_members.items():
        all_items: list[tuple[int, PageItem]] = []
        for ci in member_idxs:
            all_items.extend(clusters[ci])

        # Pick canonical label = label with most occurrences (tie-break: first seen)
        label_count: dict[str, int] = defaultdict(int)
        for _, item in all_items:
            label_count[item.label] += 1
        canonical = max(label_count, key=lambda l: label_count[l])

        item_type = all_items[0][1].type

        # Collect all unique aliases (excluding stoplist and ambiguous)
        all_aliases: list[str] = []
        seen_alias_cores: set[str] = set()
        for _, item in all_items:
            for a in _safe_aliases(item.aliases):
                ac = _label_core(a)
                if ac not in ambiguous_aliases and ac not in seen_alias_cores and ac != _label_core(canonical):
                    seen_alias_cores.add(ac)
                    all_aliases.append(a)

        # Collect evidence (page, quote), sorted by page, capped at _MAX_EVIDENCE
        evidence_pairs: list[tuple[int, str]] = sorted(
            {(pn, it.quote) for pn, it in all_items}, key=lambda x: x[0]
        )[:_MAX_EVIDENCE]

        node_idx = len(merged)
        merged.append({
            "type": item_type,
            "label": canonical,
            "aliases": all_aliases,
            "evidence": evidence_pairs,
        })

        for ci in member_idxs:
            cluster_to_node[ci] = node_idx

    # Map (page_num, local_id) → node index
    for idx, cluster in enumerate(clusters):
        node_idx = cluster_to_node.get(_find(idx))
        if node_idx is None:
            continue
        for page_num, item in cluster:
            item_key_to_node[(page_num, item.local_id)] = node_idx

    nodes_before_merge = total_raw
    steps.append({"t_ms": _ms(), "message": f"Merged {nodes_before_merge} items into {len(merged)} nodes"})

    # -----------------------------------------------------------------------
    # 4. Build edges from raw relations
    # -----------------------------------------------------------------------
    # Edge dedup key: (source_node_idx, target_node_idx, relation_lower)
    edge_map: dict[tuple[int, int, str], list[tuple[int, str]]] = defaultdict(list)

    for page_num, rel in raw_relations:
        src_key = (page_num, rel.source_local_id)
        tgt_key = (page_num, rel.target_local_id)
        src_idx = item_key_to_node.get(src_key)
        tgt_idx = item_key_to_node.get(tgt_key)
        if src_idx is None or tgt_idx is None:
            continue  # dangling — one end didn't survive
        if src_idx == tgt_idx:
            continue  # self-loop
        edge_key = (src_idx, tgt_idx, rel.relation.lower())
        edge_map[edge_key].append((page_num, rel.quote))

    # Assign ids and cap evidence
    output_nodes: list[Node] = []
    for i, m in enumerate(merged):
        ev = [Evidence(page=p, quote=q) for p, q in m["evidence"]]
        output_nodes.append(Node(
            id=f"n{i + 1}",
            label=m["label"],
            type=m["type"],
            aliases=m["aliases"],
            mentions=len(ev),
            evidence=ev,
        ))

    # node index → assigned id
    node_id_map = {i: n.id for i, n in enumerate(output_nodes)}
    node_id_set = set(node_id_map.values())

    output_edges: list[Edge] = []
    for j, ((src_idx, tgt_idx, relation), ev_list) in enumerate(edge_map.items()):
        src_id = node_id_map.get(src_idx)
        tgt_id = node_id_map.get(tgt_idx)
        if src_id not in node_id_set or tgt_id not in node_id_set:
            continue  # safety — should not happen
        ev_sorted = sorted(set(ev_list), key=lambda x: x[0])[:_MAX_EVIDENCE]
        ev_models = [Evidence(page=p, quote=q) for p, q in ev_sorted]
        # Restore relation with original casing from first occurrence
        original_relation = next(
            (r.relation for _, r in raw_relations
             if r.relation.lower() == relation),
            relation,
        )
        output_edges.append(Edge(
            id=f"e{j + 1}",
            source=src_id,
            target=tgt_id,
            relation=original_relation,
            evidence=ev_models,
        ))

    steps.append({
        "t_ms": _ms(),
        "message": f"Assembled graph: {len(output_nodes)} nodes, {len(output_edges)} edges",
    })

    if dropped:
        steps.append({
            "t_ms": _ms(),
            "message": f"Dropped {dropped} items: quotes not found on their page",
        })

    for fp in failed_pages:
        steps.append({"t_ms": _ms(), "message": f"Page {fp} couldn't be read and was skipped"})

    # -----------------------------------------------------------------------
    # 5 & 6. Build result
    # -----------------------------------------------------------------------
    duration_ms = _ms()
    stats = Stats(
        pages=len(pages),
        nodes_before_merge=nodes_before_merge,
        nodes=len(output_nodes),
        edges=len(output_edges),
        items_dropped_unverified=dropped,
        duration_ms=duration_ms,
    )

    return MapResult(
        schema_version="1",
        document=DocumentInfo(title=title, page_count=len(pages)),
        nodes=output_nodes,
        edges=output_edges,
        stats=stats,
        steps=[Step(t_ms=s["t_ms"], message=s["message"]) for s in steps],
        warnings=[f"Page {fp} couldn't be read and was skipped" for fp in failed_pages],
    )
