import { useState, useEffect } from "react";
import type { MapResult, NodeType } from "../../lib/types";
import { selectOverview } from "../../lib/overview";
import { getMap, isFallback } from "../../lib/store";
import MapGraph from "../components/MapGraph/MapGraph";
import Legend from "../components/Legend/Legend";
import NodePanel from "../components/NodePanel/NodePanel";
import StepsLog from "../components/StepsLog/StepsLog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALL_TYPES: NodeType[] = ["party", "obligation", "date", "amount", "topic"];

const TYPE_COLOR: Record<NodeType, string> = {
  party: "#2F5D8A",
  obligation: "#C8501C",
  date: "#2A7A74",
  amount: "#9A6B12",
  topic: "#6E7378",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function statsLine(map: MapResult): string {
  const { nodes, edges, items_dropped_unverified } = map.stats;
  const dropped = items_dropped_unverified;
  return `${nodes} nodes · ${edges} links${dropped ? ` · ${dropped} items dropped: quotes not found on their page` : ""}`;
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
// MapPage
// ---------------------------------------------------------------------------
interface Props {
  /** Called when the store is empty (hard refresh) — navigate back home. */
  onNavigateHome: () => void;
}

export default function MapPage({ onNavigateHome }: Props) {
  const [map, setMapState] = useState<MapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromFallback, setFromFallback] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<NodeType>>(new Set(ALL_TYPES));

  const windowWidth = useWindowWidth();
  const isWide = windowWidth >= 900;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");

    if (source === "fixture") {
      // Dev / demo path: load a fixture file directly
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

    // Production path: read from module store
    const stored = getMap();
    if (!stored) {
      onNavigateHome();
      return;
    }
    setMapState(stored);
    setFromFallback(isFallback());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div style={{ padding: 32, color: "#C8501C" }}>{error}</div>;
  if (!map)  return <div style={{ padding: 32, color: "#5B6570" }}>Loading…</div>;

  // Filter nodes/edges by active types
  const filteredNodes = map.nodes.filter((n) => activeTypes.has(n.type as NodeType));
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = map.edges.filter(
    (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
  );
  const filteredMap = { ...map, nodes: filteredNodes, edges: filteredEdges };

  const overview = selectOverview(filteredMap, 30);
  const display = showAll
    ? { nodes: filteredNodes, edges: filteredEdges, hiddenCount: 0 }
    : overview;

  // If selectedId is now hidden (type filtered), deselect
  const effectiveSelectedId =
    selectedId && filteredNodeIds.has(selectedId) ? selectedId : null;

  function toggleType(t: NodeType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        // Don't let the user deselect all types
        if (next.size === 1) return prev;
        next.delete(t);
      } else {
        next.add(t);
      }
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------
  const header = (
    <header style={{
      padding: "12px 20px",
      borderBottom: "1px solid #B9B4A8",
      background: "#F6F3EC",
      flexShrink: 0,
    }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1C2B39", lineHeight: 1.3 }}>
        {map.document.title}
      </h1>

      {/* Stats line */}
      <div style={{ marginTop: 3, fontSize: 12, fontFamily: '"IBM Plex Mono", monospace', color: "#5B6570" }}>
        {statsLine(map)}
      </div>

      {/* Fallback note */}
      {fromFallback && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#5B6570", fontStyle: "italic" }}>
          Showing a saved result.
        </div>
      )}

      {/* Warnings */}
      {map.warnings.length > 0 && (
        <ul style={{ margin: "4px 0 0", padding: "0 0 0 16px", fontSize: 12, color: "#5B6570" }}>
          {map.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {/* Legal notice */}
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#B9B4A8" }}>
        A map of what this document says, not legal advice. Check every item against the source.
      </p>

      {/* Steps log */}
      <StepsLog steps={map.steps} />

      {/* Controls row: legend + filter chips + show-more */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Legend />

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: "#B9B4A8" }} />

        {/* Type filter chips */}
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            style={{
              padding: "2px 8px",
              borderRadius: 12,
              border: `1px solid ${activeTypes.has(t) ? TYPE_COLOR[t] : "#B9B4A8"}`,
              background: activeTypes.has(t) ? TYPE_COLOR[t] + "18" : "transparent",
              color: activeTypes.has(t) ? TYPE_COLOR[t] : "#B9B4A8",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t}
          </button>
        ))}

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
  // Wide layout: graph left (~65%), panel right (~35%), both full height
  // ---------------------------------------------------------------------------
  if (isWide) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F6F3EC" }}>
        {header}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {/* Graph — 65% */}
          <div style={{ flex: "0 0 65%", minWidth: 0 }}>
            <MapGraph
              nodes={display.nodes}
              edges={display.edges}
              selectedId={effectiveSelectedId}
              onSelect={setSelectedId}
            />
          </div>

          {/* Panel — 35%, always visible */}
          <div style={{ flex: "0 0 35%", borderLeft: "1px solid #B9B4A8", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
            <NodePanel
              map={map}
              nodeId={effectiveSelectedId}
              onSelect={setSelectedId}
              onClose={() => setSelectedId(null)}
            />
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Narrow layout: graph on top, panel stacked below (plan's fork for <900px)
  // ---------------------------------------------------------------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F6F3EC" }}>
      {header}

      {/* Graph — fixed height on small screens */}
      <div style={{ height: 360, flexShrink: 0 }}>
        <MapGraph
          nodes={display.nodes}
          edges={display.edges}
          selectedId={effectiveSelectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Panel stacked below */}
      {effectiveSelectedId && (
        <div style={{ flex: 1, borderTop: "1px solid #B9B4A8", minHeight: 280 }}>
          <NodePanel
            map={map}
            nodeId={effectiveSelectedId}
            onSelect={setSelectedId}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
