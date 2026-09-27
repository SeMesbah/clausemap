/**
 * Overview selection: given a full MapResult, pick the most important nodes
 * up to `limit`, always keeping all party nodes.
 *
 * Ranking for non-party nodes: (connected edge count + mentions) descending.
 */
import type { MapResult, Node, Edge } from "./types";

export interface OverviewResult {
  nodes: Node[];
  edges: Edge[];
  hiddenCount: number;
}

export function selectOverview(map: MapResult, limit = 30): OverviewResult {
  const { nodes, edges } = map;

  // Count how many edges touch each node
  const edgeDegree = new Map<string, number>();
  for (const node of nodes) edgeDegree.set(node.id, 0);
  for (const edge of edges) {
    edgeDegree.set(edge.source, (edgeDegree.get(edge.source) ?? 0) + 1);
    edgeDegree.set(edge.target, (edgeDegree.get(edge.target) ?? 0) + 1);
  }

  const parties = nodes.filter((n) => n.type === "party");
  const others = nodes.filter((n) => n.type !== "party");

  // Score non-party nodes
  const scored = others
    .map((n) => ({ node: n, score: (edgeDegree.get(n.id) ?? 0) + n.mentions }))
    .sort((a, b) => b.score - a.score);

  // Fill remaining slots after parties
  const remaining = Math.max(0, limit - parties.length);
  const selectedOthers = scored.slice(0, remaining).map((s) => s.node);
  const selectedNodes = [...parties, ...selectedOthers];

  const selectedIds = new Set(selectedNodes.map((n) => n.id));

  // Keep only edges whose both ends are in the selected set
  const selectedEdges = edges.filter(
    (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
  );

  const hiddenCount = nodes.length - selectedNodes.length;

  return { nodes: selectedNodes, edges: selectedEdges, hiddenCount };
}
