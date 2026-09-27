/**
 * theme.ts — single source of truth for per-type visual constants.
 * Import from here instead of defining locally in each component.
 */
import type { NodeType } from "../lib/types";

export const TYPE_COLOR: Record<NodeType, string> = {
  party:      "#2F5D8A",
  obligation: "#C8501C",
  date:       "#2A7A74",
  amount:     "#9A6B12",
  topic:      "#6E7378",
};

/** Singular labels */
export const TYPE_LABEL: Record<NodeType, string> = {
  party:      "Party",
  obligation: "Obligation",
  date:       "Date",
  amount:     "Amount",
  topic:      "Topic",
};

/** Plural labels */
export const TYPE_LABEL_PLURAL: Record<NodeType, string> = {
  party:      "Parties",
  obligation: "Obligations",
  date:       "Dates",
  amount:     "Amounts",
  topic:      "Topics",
};

/** Cytoscape shape names */
export const TYPE_SHAPE: Record<NodeType, string> = {
  party:      "ellipse",
  obligation: "round-rectangle",
  date:       "diamond",
  amount:     "hexagon",
  topic:      "tag",
};

export const ALL_TYPES: NodeType[] = ["party", "obligation", "date", "amount", "topic"];
