import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
// @ts-expect-error — cytoscape-fcose has no bundled types
import fcose from "cytoscape-fcose";
import type { MapResult } from "../../lib/types";

cytoscape.use(fcose);

// ---------------------------------------------------------------------------
// Type → visual style maps
// ---------------------------------------------------------------------------
const NODE_COLORS: Record<string, string> = {
  party: "#2F5D8A",
  obligation: "#C8501C",
  date: "#2A7A74",
  amount: "#9A6B12",
  topic: "#6E7378",
};

const NODE_SHAPES: Record<string, string> = {
  party: "ellipse",
  obligation: "round-rectangle",
  date: "diamond",
  amount: "hexagon",
  topic: "tag",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  nodes: MapResult["nodes"];
  edges: MapResult["edges"];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function MapGraph({ nodes, edges, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Build / rebuild the graph when nodes or edges change
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map((n) => ({
          data: { id: n.id, label: n.label, type: n.type },
        })),
        ...edges.map((e) => ({
          data: { id: e.id, source: e.source, target: e.target },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: cytoscape.NodeSingular) =>
              NODE_COLORS[ele.data("type")] ?? "#6E7378",
            shape: (ele: cytoscape.NodeSingular) =>
              NODE_SHAPES[ele.data("type")] ?? "ellipse",
            label: (ele: cytoscape.NodeSingular) => {
              const lbl: string = ele.data("label") ?? "";
              return lbl.length > 28 ? lbl.slice(0, 27) + "…" : lbl;
            },
            "font-family": '"IBM Plex Sans", system-ui, sans-serif',
            "font-size": "12px",
            color: "#1C2B39",
            "text-valign": "bottom",
            "text-margin-y": 4,
            "text-wrap": "none",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#B9B4A8",
            "target-arrow-color": "#B9B4A8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
        {
          selector: "node.selected",
          style: {
            "border-width": 3,
            "border-color": "#C8501C",
          },
        },
        {
          selector: "edge.selected",
          style: {
            width: 3,
            "line-color": "#C8501C",
            "target-arrow-color": "#C8501C",
          },
        },
      ],
      layout: {
        name: "fcose",
        animate: false,
        randomize: true,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 90,
      } as Parameters<cytoscape.Core["layout"]>[0],
    });

    cy.fit(undefined, 40);

    cy.on("tap", "node", (evt) => {
      onSelect(evt.target.id());
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight selected node + its edges without rebuilding the graph
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("selected");
    if (selectedId) {
      const node = cy.getElementById(selectedId);
      node.addClass("selected");
      node.connectedEdges().addClass("selected");
    }
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#F6F3EC" }}
    />
  );
}
