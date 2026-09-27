import type { NodeType } from "../../../lib/types";

const LEGEND_ITEMS: { type: NodeType; color: string; shape: string; label: string }[] = [
  { type: "party",      color: "#2F5D8A", shape: "●", label: "Party" },
  { type: "obligation", color: "#C8501C", shape: "▬", label: "Obligation" },
  { type: "date",       color: "#2A7A74", shape: "◆", label: "Date" },
  { type: "amount",     color: "#9A6B12", shape: "⬡", label: "Amount" },
  { type: "topic",      color: "#6E7378", shape: "🏷", label: "Topic" },
];

export default function Legend() {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: 13 }}>
      {LEGEND_ITEMS.map(({ type, color, shape, label }) => (
        <div key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color, fontSize: 16, lineHeight: 1 }} aria-hidden>{shape}</span>
          <span style={{ color: "#1C2B39" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
