import { useState, useEffect } from "react";
import type { MapResult, Node } from "../../lib/types";
import { selectOverview } from "../../lib/overview";
import MapGraph from "../components/MapGraph/MapGraph";
import Legend from "../components/Legend/Legend";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function statsLine(map: MapResult): string {
  const { nodes, edges, items_dropped_unverified } = map.stats;
  const dropped = items_dropped_unverified;
  return `${nodes} nodes · ${edges} links${dropped ? ` · ${dropped} items dropped: quotes not found on their page` : ""}`;
}

// ---------------------------------------------------------------------------
// MapPage
// ---------------------------------------------------------------------------
export default function MapPage() {
  const [map, setMap] = useState<MapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Load fixture on mount (source=fixture in query string)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    if (source === "fixture") {
      fetch("/fixtures/sample-map.json")
        .then((r) => r.json())
        .then((data: MapResult) => setMap(data))
        .catch(() => setError("Failed to load fixture."));
    }
  }, []);

  // Sync selectedNode when selectedId changes
  useEffect(() => {
    if (!map || !selectedId) { setSelectedNode(null); return; }
    setSelectedNode(map.nodes.find((n) => n.id === selectedId) ?? null);
  }, [selectedId, map]);

  if (error) return <div style={{ padding: 32, color: "#C8501C" }}>{error}</div>;
  if (!map) return <div style={{ padding: 32, color: "#5B6570" }}>Loading…</div>;

  const overview = selectOverview(map, 30);
  const display = showAll
    ? { nodes: map.nodes, edges: map.edges, hiddenCount: 0 }
    : overview;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F6F3EC", fontFamily: '"IBM Plex Sans", system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ padding: "16px 24px", borderBottom: "1px solid #B9B4A8" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1C2B39" }}>
          {map.document.title}
        </h1>
        <div style={{ marginTop: 4, fontSize: 13, fontFamily: '"IBM Plex Mono", monospace', color: "#5B6570" }}>
          {statsLine(map)}
        </div>
        <p style={{ marginTop: 6, fontSize: 12, color: "#5B6570" }}>
          A map of what this document says, not legal advice. Check every item against the source.
        </p>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <Legend />
          {overview.hiddenCount > 0 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{ fontSize: 13, color: "#2F5D8A", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
            >
              {showAll ? "Show overview" : `Show ${overview.hiddenCount} more`}
            </button>
          )}
        </div>
      </header>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Graph */}
        <div style={{ flex: 1 }}>
          <MapGraph
            nodes={display.nodes}
            edges={display.edges}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Node panel */}
        {selectedNode && (
          <aside style={{ width: 300, borderLeft: "1px solid #B9B4A8", overflowY: "auto", padding: 16, background: "#fff" }}>
            <button
              onClick={() => setSelectedId(null)}
              style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#5B6570" }}
              aria-label="Close"
            >×</button>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#5B6570", marginBottom: 4 }}>
              {selectedNode.type}
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C2B39", margin: "0 0 8px" }}>
              {selectedNode.label}
            </h2>
            {selectedNode.aliases.length > 0 && (
              <p style={{ fontSize: 13, color: "#5B6570", margin: "0 0 12px" }}>
                Also: {selectedNode.aliases.join(", ")}
              </p>
            )}
            <div style={{ fontSize: 13, color: "#5B6570", marginBottom: 12 }}>
              Mentioned on {selectedNode.evidence.length} page{selectedNode.evidence.length !== 1 ? "s" : ""}
            </div>
            {selectedNode.evidence.map((ev, i) => (
              <blockquote key={i} style={{ margin: "0 0 12px", padding: "8px 12px", borderLeft: "3px solid #B9B4A8", background: "#F6F3EC", fontSize: 13, color: "#1C2B39", fontFamily: '"Source Serif 4", Georgia, serif', fontStyle: "italic" }}>
                <span style={{ fontStyle: "normal", fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: "#5B6570" }}>p.{ev.page} — </span>
                {ev.quote}
              </blockquote>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
