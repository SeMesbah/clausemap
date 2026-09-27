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
    """Normalised label with leading 'the' or honorific, punctuation and whitespace removed."""
    s = normalize(label)
    s = _strip_punct(s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"^the\s+", "", s)
    s = re.sub(r"^(mr|mrs|ms|miss|dr|prof)\s+", "", s)
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


def _merge_key(label: str) -> str:
    """Primary merge key: full normalised label core (suffix kept).

    Type is deliberately NOT part of the key: the model often types the same
    thing differently on different pages ("Principal" as topic and amount),
    and those must still merge. The node's type is decided by _group_type.

    Keeping the suffix in the key means "Acme Holdings Inc." and
    "Acme Holdings Ltd." land in separate primary buckets and are only
    merged in the union-find cross-match pass — which enforces the
    suffix-compatibility rule.  "Acme Holdings" (no suffix) gets its own
    bucket and is merged with Inc. via the cross-match.
    """
    return _label_core(label)


# Tie-break order when a merged node's mentions disagree on type
_TYPE_PRIORITY = ["party", "obligation", "amount", "date", "topic"]


def _group_type(items: list[tuple[int, PageItem]]) -> str:
    """Majority type across a merged node's mentions (tie → _TYPE_PRIORITY)."""
    counts: dict[str, int] = defaultdict(int)
    for _, it in items:
        counts[it.type] += 1
    return max(counts, key=lambda t: (counts[t], -_TYPE_PRIORITY.index(t)))


# Words too generic to show that a quote names a particular node
_NAME_STOPWORDS = {
    "the", "of", "and", "a", "an", "to", "for", "in", "on", "by", "at", "with",
    "from", "or", "eur", "euro", "euros", "day", "days", "date",
}


def _quote_names(quote: str, names: set[str]) -> bool:
    """True if the quote contains a significant word of any of the node's names.

    Guards against the model wiring a relation to the wrong local_id: the
    quote is real, but it doesn't mention one of the two ends.
    """
    words = set(_strip_punct(normalize(quote)).split())
    for n in names:
        for w in n.split():
            if len(w) >= 3 and w not in _NAME_STOPWORDS and (w in words or w + "s" in words):
                return True
    return False


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

        if ext.failed:
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
    # Staged, so one bad alias from the model can't chain unrelated nodes
    # together:
    #   a) Group items whose normalised label is identical, regardless of type
    #      (the model may call the same thing a topic on one page and an
    #      amount on another).
    #   b) Union groups whose LABELS match once company suffixes are stripped
    #      ("Acme Holdings" ↔ "Acme Holdings Inc."). Two labels that BOTH have
    #      company suffixes, and the suffixes differ, are never merged.
    #   c) A one-word party label ("Hoek", "Harbourlight") joins the single
    #      party whose full label starts or ends with that word. Skipped when
    #      more than one party matches ("Vandermeer").
    #   d) Aliases, from any mention: a group whose label equals an alias
    #      joins the group that declared it — only if that group makes ≥75%
    #      of the declarations ("the Borrower" on two people merges nothing),
    #      the absorbed group is a bare role (all labels one word, e.g.
    #      "Lender"), both groups have the same type, and it's not a date or
    #      amount.
    # -----------------------------------------------------------------------

    # cluster: list of (page_num, item)
    clusters: list[list[tuple[int, PageItem]]] = []
    key_to_cluster: dict[str, int] = {}   # primary key → cluster index

    for page_num, item in raw_items:
        key = _merge_key(item.label)
        if key in key_to_cluster:
            clusters[key_to_cluster[key]].append((page_num, item))
        else:
            key_to_cluster[key] = len(clusters)
            clusters.append([(page_num, item)])

    cluster_label = [_label_core(c[0][1].label) for c in clusters]
    cluster_aliases = [
        {ac for _, it in c for a in _safe_aliases(it.aliases) if (ac := _label_core(a))}
        for c in clusters
    ]
    cluster_suffix = [_has_company_suffix(lbl) for lbl in cluster_label]

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

    def _groups() -> dict[int, list[int]]:
        g: dict[int, list[int]] = defaultdict(list)
        for i in range(len(clusters)):
            g[_find(i)].append(i)
        return g

    def _group_items(members: list[int]) -> list[tuple[int, PageItem]]:
        return [x for ci in members for x in clusters[ci]]

    # b) Suffix-stripped label match. First-seen wins, so a suffixed label
    #    (registered first) isn't overwritten by a bare label.
    stripped_to_cluster: dict[str, int] = {}
    for idx, lbl in enumerate(cluster_label):
        stripped_to_cluster.setdefault(_core_without_suffix(lbl), idx)
    for idx, lbl in enumerate(cluster_label):
        other = stripped_to_cluster[_core_without_suffix(lbl)]
        if other == idx:
            continue
        s1, s2 = cluster_suffix[idx], cluster_suffix[other]
        if s1 and s2 and s1 != s2:
            continue
        _union(idx, other)

    # c) One-word party labels
    groups = _groups()
    group_type = {r: _group_type(_group_items(ms)) for r, ms in groups.items()}
    party_roots = [r for r, t in group_type.items() if t == "party"]
    end_word_roots: dict[str, set[int]] = defaultdict(set)
    for r in party_roots:
        for ci in groups[r]:
            words = _core_without_suffix(cluster_label[ci]).split()
            if len(words) >= 2:
                end_word_roots[words[0]].add(r)
                end_word_roots[words[-1]].add(r)
    for r in party_roots:
        labels = {cluster_label[ci] for ci in groups[r]}
        if any(len(lbl.split()) > 1 for lbl in labels):
            continue
        candidates: set[int] = set()
        for lbl in labels:
            if len(lbl) >= 3:
                candidates |= end_word_roots.get(lbl, set())
        candidates.discard(r)
        if len(candidates) == 1:
            _union(candidates.pop(), r)

    # d) Unambiguous aliases
    groups = _groups()
    group_type = {r: _group_type(_group_items(ms)) for r, ms in groups.items()}
    label_roots: dict[str, set[int]] = defaultdict(set)
    # alias → root → number of mentions declaring it
    alias_votes: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    role_only: set[int] = set()  # groups whose labels are all one word ("Lender")
    for r, ms in groups.items():
        own_labels = {cluster_label[ci] for ci in ms}
        if all(len(lbl.split()) == 1 for lbl in own_labels):
            role_only.add(r)
        for lbl in own_labels:
            label_roots[lbl].add(r)
        for ci in ms:
            for _, it in clusters[ci]:
                for a in {_label_core(a) for a in _safe_aliases(it.aliases)} - own_labels:
                    if a:
                        alias_votes[a][r] += 1
    for alias, votes in alias_votes.items():
        # The owner must make ≥75% of the declarations, so one stray
        # mis-tag (Hoek "the Lender" once vs Harbourlight four times) is
        # outvoted, but a genuinely shared role (two Borrowers) merges nothing.
        owner = max(votes, key=votes.get)
        if votes[owner] < 0.75 * sum(votes.values()):
            continue
        if group_type[owner] in ("date", "amount"):
            continue
        for target in label_roots.get(alias, ()):
            # Only a bare role group ("Lender", "the Company") is absorbed. A
            # group that already has a proper name ("Municipality of
            # Harlingerzijl") is a separate entity; an alias pointing at it
            # is the model confusing two names that share a sentence.
            if (target != owner and target in role_only
                    and group_type[target] == group_type[owner]):
                _union(owner, target)

    # Build final merged items
    merged: list[dict] = []  # {type, label, aliases, evidence, names}

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

    for root, member_idxs in _groups().items():
        all_items = _group_items(member_idxs)
        item_type = _group_type(all_items)

        # Canonical label: for parties the fullest name ("Maarten Hoek" over
        # "Hoek"); otherwise the most frequent label (tie-break: first seen).
        label_count: dict[str, int] = defaultdict(int)
        for _, item in all_items:
            label_count[item.label] += 1
        if item_type == "party":
            canonical = max(label_count, key=lambda l: (len(_label_core(l).split()), label_count[l]))
        else:
            canonical = max(label_count, key=lambda l: label_count[l])

        # Collect all unique aliases (excluding stoplist and ambiguous)
        all_aliases: list[str] = []
        seen_alias_cores: set[str] = {_label_core(canonical)}
        for _, item in all_items:
            for a in [item.label] + _safe_aliases(item.aliases):
                ac = _label_core(a)
                if ac not in ambiguous_aliases and ac not in seen_alias_cores:
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
            "names": {n for ci in member_idxs for n in cluster_aliases[ci] | {cluster_label[ci]}},
        })

        for ci in member_idxs:
            cluster_to_node[ci] = node_idx

    # Map (page_num, local_id) → node index
    for idx, cluster in enumerate(clusters):
        node_idx = cluster_to_node[idx]
        for page_num, item in cluster:
            item_key_to_node[(page_num, item.local_id)] = node_idx

    nodes_before_merge = total_raw
    steps.append({"t_ms": _ms(), "message": f"Merged {nodes_before_merge} items into {len(merged)} nodes"})

    # -----------------------------------------------------------------------
    # 4. Build edges from raw relations
    # -----------------------------------------------------------------------
    # Edge dedup key: (source_node_idx, target_node_idx, relation_lower)
    edge_map: dict[tuple[int, int, str], list[tuple[int, str]]] = defaultdict(list)
    unanchored = 0

    for page_num, rel in raw_relations:
        src_key = (page_num, rel.source_local_id)
        tgt_key = (page_num, rel.target_local_id)
        src_idx = item_key_to_node.get(src_key)
        tgt_idx = item_key_to_node.get(tgt_key)
        if src_idx is None or tgt_idx is None:
            continue  # dangling — one end didn't survive
        if src_idx == tgt_idx:
            continue  # self-loop
        if not (_quote_names(rel.quote, merged[src_idx]["names"])
                and _quote_names(rel.quote, merged[tgt_idx]["names"])):
            unanchored += 1
            continue  # quote doesn't name both ends — likely a mis-wired id
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

    if unanchored:
        steps.append({
            "t_ms": _ms(),
            "message": f"Dropped {unanchored} links: quote doesn't name both ends",
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
