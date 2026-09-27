/**
 * MapGraph — renders the contract map using cytoscape-fcose.
 *
 * The cytoscape instance is created ONCE per map. Visibility changes
 * (filter / overview) add/remove the `hidden` class and re-run the
 * layout with randomize:false so positions are preserved.
 */
import { useEffect, useRef, useCallback } from "react";
import cytoscape from "cytoscape";
// @ts-expect-error — cytoscape-fcose has no bundled types
import fcose from "cytoscape-fcose";
import type { MapResult } from "../../../lib/types";
import { TYPE_COLOR, TYPE_SHAPE } from "../../theme";

cytoscape.use(fcose);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mapData(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return (outMin + outMax) / 2;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function applyVisibility(cy: cytoscape.Core, visibleIds: Set<string>) {
  cy.nodes().forEach((node) => {
    if (visibleIds.has(node.id())) {
      node.removeClass("hidden");
    } else {
      node.addClass("hidden");
    }
  });
  cy.edges().forEach((edge) => {
    const hidden = edge.source().hasClass("hidden") || edge.target().hasClass("hidden");
    if (hidden) edge.addClass("hidden");
    else edge.removeClass("hidden");
  });
}

function runLayout(
  cy: cytoscape.Core,
  isFirst: boolean,
  layoutRef: React.MutableRefObject<cytoscape.Layouts | null>
) {
  if (layoutRef.current) {
    layoutRef.current.stop();
    layoutRef.current = null;
  }

  const layout = cy.elements(":visible").layout({
    name: "fcose",
    animate: !REDUCED_MOTION,
    animationDuration: isFirst ? 800 : 400,
    animationEasing: isFirst ? "ease-out-cubic" : ("ease-in-out-cubic" as unknown as undefined),
    randomize: isFirst,
    fit: false,
    nodeRepulsion: () => 8000,
    idealEdgeLength: () => 90,
  } as Parameters<cytoscape.Core["layout"]>[0]);

  layout.on("layoutstop", () => {
    if (isFirst) cy.fit(undefined, 40);
    layoutRef.current = null;
  });

  layoutRef.current = layout;
  layout.run();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  /** Full node/edge set — never changes while this map is mounted */
  nodes: MapResult["nodes"];
  edges: MapResult["edges"];
  /** IDs of currently visible nodes (filter + overview). All others are hidden. */
  visibleIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function MapGraph({ nodes, edges, visibleIds, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const layoutRef = useRef<cytoscape.Layouts | null>(null);
  const visibleIdsRef = useRef<Set<string>>(visibleIds);

  visibleIdsRef.current = visibleIds;

  // ------------------------------------------------------------------
  // Create cytoscape ONCE when nodes/edges mount
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const maxMentions = Math.max(...nodes.map((n) => n.mentions), 1);

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map((n) => ({
          data: {
            id: n.id,
            label: n.label,
            type: n.type,
            mentions: n.mentions,
            size: mapData(n.mentions, 1, maxMentions, 22, 56),
          },
        })),
        ...edges.map((e) => ({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            relation: e.relation,
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele: cytoscape.NodeSingular) =>
              TYPE_COLOR[ele.data("type") as keyof typeof TYPE_COLOR] ?? "#6E7378",
            shape: (ele: cytoscape.NodeSingular) =>
              (TYPE_SHAPE[ele.data("type") as keyof typeof TYPE_SHAPE] ?? "ellipse") as cytoscape.Css.NodeShape,
            width: (ele: cytoscape.NodeSingular) => ele.data("size") as number,
            height: (ele: cytoscape.NodeSingular) => ele.data("size") as number,
            label: "data(label)",
            "font-family": '"IBM Plex Sans", system-ui, sans-serif',
            "font-size": "12px",
            color: "#1C2B39",
            "text-valign": "bottom",
            "text-margin-y": 4,
            "text-wrap": "ellipsis",
            "text-max-width": "120px",
            "min-zoomed-font-size": 8,
            "transition-property": "opacity",
            "transition-duration": 150,
          },
        },
        { selector: "node.hidden", style: { display: "none" } },
        { selector: "node.faded", style: { opacity: 0.15 } },
        {
          selector: "node.selected",
          style: { "border-width": 3, "border-color": "#C8501C" },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#B9B4A8",
            "target-arrow-color": "#B9B4A8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "transition-property": "opacity",
            "transition-duration": 150,
          },
        },
        { selector: "edge.hidden", style: { display: "none" } },
        { selector: "edge.faded", style: { opacity: 0.15 } },
        {
          selector: "edge.labelled, edge.selected",
          style: {
            label: "data(relation)",
            "font-size": "10px",
            color: "#5B6570",
            "text-rotation": "autorotate",
            "text-background-color": "#F6F3EC",
            "text-background-opacity": 1,
            "text-background-padding": "2px",
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
    });

    // Node tap → select
    cy.on("tap", "node", (evt) => {
      onSelect(evt.target.id() as string);
    });

    // Background tap → deselect
    cy.on("tap", (evt) => {
      if (evt.target === cy) onSelect(null);
    });

    // Hover: fade non-neighbours, show edge labels
    cy.on("mouseover", "node", (evt) => {
      const node = evt.target as cytoscape.NodeSingular;
      const neighbourhood = node.closedNeighborhood();
      cy.elements().not(neighbourhood).addClass("faded");
      node.connectedEdges().not(".hidden").addClass("labelled");
    });

    cy.on("mouseout", "node", () => {
      cy.elements().removeClass("faded");
      cy.edges().removeClass("labelled");
    });

    cyRef.current = cy;

    applyVisibility(cy, visibleIdsRef.current);
    runLayout(cy, true, layoutRef);

    return () => {
      if (layoutRef.current) {
        layoutRef.current.stop();
        layoutRef.current = null;
      }
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // ------------------------------------------------------------------
  // ResizeObserver → cy.resize()
  // ------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => cyRef.current?.resize());
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ------------------------------------------------------------------
  // Visibility changes
  // ------------------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyVisibility(cy, visibleIds);
    runLayout(cy, false, layoutRef);
  }, [visibleIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Selection changes
  // ------------------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass("selected faded labelled");

    if (!selectedId) return;

    const node = cy.getElementById(selectedId);
    if (!node.length) return;

    node.addClass("selected");
    node.connectedEdges().not(".hidden").addClass("selected labelled");

    const neighbourhood = node.closedNeighborhood();
    cy.elements().not(neighbourhood).not(".hidden").addClass("faded");

    if (!REDUCED_MOTION) {
      cy.animate(
        { center: { eles: node }, zoom: Math.max(cy.zoom(), 1.1) },
        { duration: 400, easing: "ease-in-out-cubic" as cytoscape.Css.TransitionTimingFunction }
      );
    } else {
      cy.center(node);
    }
  }, [selectedId]);

  // ------------------------------------------------------------------
  // Zoom controls
  // ------------------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ zoom: cy.zoom() * 1.3 }, { duration: 250 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ zoom: cy.zoom() / 1.3 }, { duration: 250 });
  }, []);

  const handleFit = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ fit: { eles: cy.elements(":visible"), padding: 40 } }, { duration: 250 });
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", background: "#F6F3EC" }}
      />

      {/* Zoom controls — bottom-right overlay */}
      <div style={{
        position: "absolute", bottom: 16, right: 16,
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        {([
          { label: "+", title: "Zoom in",  fn: handleZoomIn },
          { label: "−", title: "Zoom out", fn: handleZoomOut },
          { label: "⊡", title: "Fit",       fn: handleFit },
        ] as const).map(({ label, title, fn }) => (
          <button
            key={title}
            title={title}
            onClick={fn}
            style={{
              width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#F6F3EC",
              border: "1px solid #B9B4A8",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              color: "#1C2B39",
              fontFamily: "inherit",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1C2B39")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#B9B4A8")}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
