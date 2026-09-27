/**
 * TypeScript types for the Clausemap API contract v1.
 * Source of truth: docs/contract.md — do not drift from it.
 */

export type NodeType = "party" | "obligation" | "date" | "amount" | "topic";

export interface Evidence {
  /** 1-based page number */
  page: number;
  quote: string;
}

export interface Node {
  id: string;
  label: string;
  type: NodeType;
  aliases: string[];
  mentions: number;
  /** Never empty */
  evidence: Evidence[];
}

export interface Edge {
  id: string;
  /** Must exist in nodes */
  source: string;
  /** Must exist in nodes */
  target: string;
  relation: string;
  /** Never empty */
  evidence: Evidence[];
}

export interface Stats {
  pages: number;
  nodes_before_merge: number;
  nodes: number;
  edges: number;
  items_dropped_unverified: number;
  duration_ms: number;
}

export interface Step {
  t_ms: number;
  message: string;
}

export interface DocumentInfo {
  title: string;
  page_count: number;
}

export interface MapResult {
  schema_version: "1";
  document: DocumentInfo;
  nodes: Node[];
  edges: Edge[];
  stats: Stats;
  steps: Step[];
  warnings: string[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
