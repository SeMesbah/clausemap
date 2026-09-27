import { useState, useEffect, useRef } from "react";
import type { MapResult, NodeType } from "../../lib/types";
import { selectOverview } from "../../lib/overview";
import { getMap, isFallback } from "../../lib/store";
import MapGraph from "../components/MapGraph/MapGraph";
import NodePanel from "../components/NodePanel/NodePanel";
import StepsLog from "../components/StepsLog/StepsLog";
import TypeFilter from "../components/TypeFilter/TypeFilter";
import { ALL_TYPES, TYPE_LABEL_PLURAL, TYPE_COLOR } from "../theme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildStatsLine(map: MapResult): string {
  const counts = countByType(map);
  const parts: string[] = [];
  if (counts.party)      parts.push(`${counts.party} ${counts.party === 1 ? "party" : "parties"}`);
  if (counts.obligation) parts.push(`${counts.obligation} obligation${counts.obligation !== 1 ? "s" : ""}`);
  if (counts.date)       parts.push(`${counts.date} date${counts.date !== 1 ? "s" : ""}`);
  if (counts.amount)     parts.push(`${counts.amount} amount${counts.amount !== 1 ? "s" : ""}`);
  const pages = map.stats.pages;
  parts.push(`${pages} page${pages !== 1 ? "s" : ""}`);
  return parts.join(" · ");
}

function countByType(map: MapResult): Record<NodeType, number> {
  const c = { party: 0, obligation: 0, date: 0, amount: 0, topic: 0 } as Record<NodeType, number>;
  for (const n of map.nodes) c[n.type as NodeType] = (c[n.type as NodeType] ?? 0) + 1;
  return c;
}

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

// ---------------------------------------------------------------------------
// DocSummary — panel empty state
// ---------------------------------------------------------------------------
interface DocSummaryProps {
  map: MapResult;
  onSelect: (id: string) => void;
}
function DocSummary({ map, onSelect }: DocSummaryProps) {
  const parties = map.nodes.filter((n) => n.type === "party");
  const dropped = map.stats.items_dropped_unverified;

  return (
    <div style={{ padding: "16px 16px 24px", fontFamily: '"IBM Plex Sans", system-ui, sans-serif' }}>
      {/* Document header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#1C2B39", lineHeight: 1.3, marginBottom: 3 }}>
          {map.document.title}
        </div>
        <div style={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace', color: "#5B6570" }}>
          {map.document.page_count} page{map.document.page_count !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Counts per type */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 14 }}>
        {ALL_TYPES.map((t) => {
          const count = map.nodes.filter((n) => n.type === t).length;
          if (!count) return null;
          return (
            <span key={t} style={{ fontSize: 12, color: "#5B6570" }}>
              <span style={{ color: TYPE_COLOR[t], fontWeight: 600 }}>{count}</span>{" "}
              {TYPE_LABEL_PLURAL[t].toLowerCase()}
            </span>
          );
        })}
      </div>

      {/* Parties as click buttons */}
      {parties.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5B6570", marginBottom: 6 }}>
            Parties
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {parties.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 12,
                  border: "1px solid #2F5D8A44",
                  background: "#2F5D8A0F",
                  color: "#2F5D8A",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Items dropped */}
      {dropped > 0 && (
        <p style={{ fontSize: 12, color: "#5B6570", marginBottom: 14 }}>
          {dropped} item{dropped !== 1 ? "s" : ""} left off the map: their quotes weren't found on the cited page.
        </p>
      )}

      {/* Steps log */}
      <StepsLog steps={map.steps} />

      {/* Warnings */}
      {map.warnings.length > 0 && (
        <ul style={{ margin: "8px 0 0", padding: "0 0 0 16px", fontSize: 12, color: "#5B6570" }}>
          {map.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {/* Hint */}
      <p style={{ marginTop: 16, fontSize: 12, color: "#5B6570", fontStyle: "italic" }}>
        Hover to trace links. Click for the exact lines.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MapPage
// ---------------------------------------------------------------------------
interface Props {
  onNavigateHome: () => void;
}

export default function MapPage({ onNavigateHome }: Props) {
  const [map, setMapState] = useState<MapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromFallback, setFromFallback] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<NodeType>>(new Set(ALL_TYPES));
  const [searchQuery, setSearchQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const windowWidth = useWindowWidth();
  const isWide = windowWidth >= 900;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");

    if (source === "fixture") {
      const file = params.get("file") ?? "sample-map";
      fetch(`/fixtures/${file}.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: MapResult) => setMapState(data))
        .catch(() => setError(`Failed to load fixture "${file}".`));
      return;
    }

    const stored = getMap();
    if (!stored) {
      onNavigateHome();
      return;
    }
    setMapState(stored);
    setFromFallback(isFallback());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{
          padding: "10px 14px",
          borderRadius: 6,
          background: "#FBEFEC",
          borderLeft: "3px solid #A1302A",
          color: "#1C2B39",
          fontSize: 14,
        }}>
          {error}
        </div>
      </div>
    );
  }
  if (!map) return <div style={{ padding: 32, color: "#5B6570" }}>Loading…</div>;

  // ---------------------------------------------------------------------------
  // Compute visible IDs from filter + overview/show-all
  // ---------------------------------------------------------------------------
  const typedNodes = map.nodes.filter((n) => activeTypes.has(n.type as NodeType));
  const typedEdges = map.edges.filter((e) => {
    const typedIds = new Set(typedNodes.map((n) => n.id));
    return typedIds.has(e.source) && typedIds.has(e.target);
  });
  const typedMap = { ...map, nodes: typedNodes, edges: typedEdges };

  const overview = selectOverview(typedMap, 30);
  const display = showAll ? typedNodes : overview.nodes;
  const visibleIds = new Set(display.map((n) => n.id));

  const effectiveSelectedId =
    selectedId && visibleIds.has(selectedId) ? selectedId : null;

  const typeCounts = countByType(map);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function toggleType(t: NodeType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size === 1) return prev;
        next.delete(t);
      } else {
        next.add(t);
      }
      return next;
    });
    setShowAll(false);
  }

  function handleSelect(id: string | null) {
    setSelectedId(id);
    if (id && !isWide) {
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    if (!map) return;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const match = map.nodes.find(
      (n) =>
        n.label.toLowerCase() === q ||
        n.aliases.some((a) => a.toLowerCase() === q)
    );
    if (!match) return;
    // Turn on type if currently filtered out
    if (!activeTypes.has(match.type as NodeType)) {
      setActiveTypes((prev) => new Set([...prev, match.type as NodeType]));
    }
    handleSelect(match.id);
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------
  const statsDropped = map.stats.items_dropped_unverified;

  const header = (
    <header style={{
      padding: "10px 16px",
      borderBottom: "1px solid #B9B4A8",
      background: "#F6F3EC",
      flexShrink: 0,
    }}>
      {/* Row 1: wordmark · title · stats */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <button
          onClick={() => {
            history.replaceState(null, "", window.location.pathname);
            onNavigateHome();
          }}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontSize: 13, fontWeight: 600, color: "#5B6570",
            letterSpacing: "0.04em", fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            textTransform: "lowercase",
            lineHeight: 1,
          }}
          title="Back to home"
        >
          clausemap
        </button>

        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1C2B39", lineHeight: 1.3, flex: "1 1 auto", minWidth: 0 }}>
          {map.document.title}
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace', color: "#5B6570" }}>
            {buildStatsLine(map)}
          </span>
          {fromFallback && (
            <span style={{
              fontSize: 11, color: "#5B6570",
              padding: "1px 6px", border: "1px solid #B9B4A8", borderRadius: 10,
              fontStyle: "italic",
            }}>
              Saved result
            </span>
          )}
        </div>
      </div>

      {/* Dropped items line */}
      {statsDropped > 0 && (
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#5B6570" }}>
          {statsDropped} item{statsDropped !== 1 ? "s" : ""} left off the map: their quotes weren't found on the cited page.
        </p>
      )}

      {/* Row 2: TypeFilter · search · show-more */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <TypeFilter counts={typeCounts} activeTypes={activeTypes} onToggle={toggleType} />

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: "#B9B4A8", flexShrink: 0 }} />

        {/* Search */}
        <input
          list="node-options"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Find a party, date, amount…"
          style={{
            fontSize: 12, padding: "3px 8px",
            border: "1px solid #B9B4A8", borderRadius: 4,
            background: "#FDFAF4", color: "#1C2B39",
            fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            outline: "none",
            width: 180,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#1C2B39")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#B9B4A8")}
        />
        <datalist id="node-options">
          {map.nodes.flatMap((n) => [n.label, ...n.aliases]).map((label, i) => (
            <option key={i} value={label} />
          ))}
        </datalist>

        {/* Show more / overview toggle */}
        {overview.hiddenCount > 0 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{
              fontSize: 12, color: "#2F5D8A", background: "none",
              border: "none", cursor: "pointer", padding: 0,
              textDecoration: "underline", fontFamily: "inherit",
            }}
          >
            {showAll ? "Show overview" : `Show ${overview.hiddenCount} more`}
          </button>
        )}
      </div>
    </header>
  );

  // ---------------------------------------------------------------------------
  // Wide layout
  // ---------------------------------------------------------------------------
  if (isWide) {
    return (
      <div className="page-in" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F6F3EC" }}>
        {header}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {/* Graph — 65% */}
          <div style={{ flex: "0 0 65%", minWidth: 0 }}>
            <MapGraph
              nodes={map.nodes}
              edges={map.edges}
              visibleIds={visibleIds}
              selectedId={effectiveSelectedId}
              onSelect={handleSelect}
            />
          </div>

          {/* Panel — 35% */}
          <div style={{ flex: "0 0 35%", borderLeft: "1px solid #B9B4A8", minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div key={effectiveSelectedId ?? "summary"} className="panel-in" style={{ flex: 1, overflow: "auto" }}>
              {effectiveSelectedId ? (
                <NodePanel
                  map={map}
                  nodeId={effectiveSelectedId}
                  onSelect={handleSelect}
                  onClose={() => handleSelect(null)}
                />
              ) : (
                <DocSummary map={map} onSelect={handleSelect} />
              )}
            </div>
          </div>
        </div>

        {/* Legal notice footer */}
        <div style={{
          padding: "6px 16px",
          borderTop: "1px solid #B9B4A8",
          fontSize: 11, color: "#5B6570",
          flexShrink: 0,
        }}>
          A map of what this document says, not legal advice. Check every item against the source.
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Narrow layout
  // ---------------------------------------------------------------------------
  return (
    <div className="page-in" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F6F3EC" }}>
      {header}

      <div style={{ height: 360, flexShrink: 0 }}>
        <MapGraph
          nodes={map.nodes}
          edges={map.edges}
          visibleIds={visibleIds}
          selectedId={effectiveSelectedId}
          onSelect={handleSelect}
        />
      </div>

      {effectiveSelectedId && (
        <div ref={panelRef} style={{ flex: 1, borderTop: "1px solid #B9B4A8", minHeight: 280 }}>
          <div key={effectiveSelectedId} className="panel-in">
            <NodePanel
              map={map}
              nodeId={effectiveSelectedId}
              onSelect={handleSelect}
              onClose={() => handleSelect(null)}
            />
          </div>
        </div>
      )}

      {!effectiveSelectedId && (
        <div ref={panelRef}>
          <DocSummary map={map} onSelect={handleSelect} />
        </div>
      )}

      {/* Legal notice footer */}
      <div style={{
        padding: "6px 16px",
        borderTop: "1px solid #B9B4A8",
        fontSize: 11, color: "#5B6570",
      }}>
        A map of what this document says, not legal advice. Check every item against the source.
      </div>
    </div>
  );
}
