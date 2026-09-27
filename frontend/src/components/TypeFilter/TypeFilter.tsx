/**
 * TypeFilter — one chip per node type, replaces Legend + filter-chip row.
 * Shows a small inline SVG of the real shape, plural label, and count.
 */
import type { NodeType } from "../../../lib/types";
import { TYPE_COLOR, TYPE_LABEL_PLURAL, ALL_TYPES } from "../../theme";

// Inline SVG shape glyphs that match the cytoscape shapes
function ShapeGlyph({ type, color }: { type: NodeType; color: string }) {
  const size = 12;
  switch (type) {
    case "party":
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
          <ellipse cx="6" cy="6" rx="5.5" ry="5.5" fill={color} />
        </svg>
      );
    case "obligation":
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
          <rect x="0.5" y="0.5" width="11" height="11" rx="3" fill={color} />
        </svg>
      );
    case "date":
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
          <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" fill={color} />
        </svg>
      );
    case "amount":
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
          <polygon points="3,0.5 9,0.5 12,6 9,11.5 3,11.5 0,6" fill={color} />
        </svg>
      );
    case "topic":
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
          <polygon points="0.5,0.5 9,0.5 11.5,6 9,11.5 0.5,11.5" fill={color} />
        </svg>
      );
    default:
      return null;
  }
}

interface Props {
  counts: Record<NodeType, number>;
  activeTypes: Set<NodeType>;
  onToggle: (type: NodeType) => void;
}

export default function TypeFilter({ counts, activeTypes, onToggle }: Props) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {ALL_TYPES.map((t) => {
        const active = activeTypes.has(t);
        const color = TYPE_COLOR[t];
        return (
          <button
            key={t}
            onClick={() => onToggle(t)}
            aria-pressed={active}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 14,
              border: `1px solid ${active ? color : "#B9B4A8"}`,
              background: active ? color + "18" : "transparent",
              color: active ? color : "#5B6570",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              outline: "none",
              transition: "border-color 0.1s, background 0.1s",
            }}
            onFocus={(e) => (e.currentTarget.style.outline = "2px solid #1C2B39")}
            onBlur={(e) => (e.currentTarget.style.outline = "none")}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = "#5B6570"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = "#B9B4A8"; }}
          >
            <ShapeGlyph type={t} color={active ? color : "#B9B4A8"} />
            <span>
              {TYPE_LABEL_PLURAL[t]}{" "}
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 400 }}>
                {counts[t]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
