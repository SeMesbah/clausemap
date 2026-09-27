/**
 * NodePanel — shows a selected node's type, aliases, linked nodes and evidence.
 */
import { useState } from "react";
import type { MapResult, Node, Edge, Evidence } from "../../../lib/types";
import { TYPE_COLOR, TYPE_LABEL } from "../../theme";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface EvidenceItemProps {
  ev: Evidence;
}
function EvidenceItem({ ev }: EvidenceItemProps) {
  return (
    <blockquote style={{
      margin: "0 0 10px",
      padding: "10px 12px",
      background: "#F2E3A0",   /* highlighter */
      borderRadius: 4,
      borderLeft: "3px solid #9A6B12",
    }}>
      <span style={{
        display: "block",
        fontFamily: '"Source Serif 4", Georgia, serif',
        fontSize: 15,
        lineHeight: 1.55,
        color: "#1C2B39",
        fontStyle: "italic",
      }}>
        "{ev.quote}"
      </span>
      <span style={{
        display: "block",
        marginTop: 6,
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 11,
        color: "#5B6570",
      }}>
        p.{ev.page} · verified
      </span>
    </blockquote>
  );
}

interface LinkItemProps {
  relation: string;
  direction: "out" | "in";
  otherLabel: string;
  otherId: string;
  onSelect: (id: string) => void;
}
function LinkItem({ relation, direction, otherLabel, otherId, onSelect }: LinkItemProps) {
  const arrow = direction === "out" ? "→" : "←";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 8, fontSize: 13 }}>
      <span style={{ color: "#5B6570", flexShrink: 0, marginTop: 1 }}>{arrow}</span>
      <span style={{ color: "#5B6570", flexShrink: 0 }}>{relation}</span>
      <button
        onClick={() => onSelect(otherId)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#2F5D8A", padding: 0, textAlign: "left",
          fontFamily: "inherit", fontSize: 13,
          textDecoration: "underline dotted",
        }}
      >
        {otherLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NodePanel
// ---------------------------------------------------------------------------

interface Props {
  map: MapResult;
  nodeId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

export default function NodePanel({ map, nodeId, onSelect, onClose }: Props) {
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);

  const LINKS_THRESHOLD = 8;
  const EVIDENCE_THRESHOLD = 5;

  // Empty state
  if (!nodeId) {
    return (
      <div style={panelStyle}>
        <EmptyState />
      </div>
    );
  }

  const node: Node | undefined = map.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  // Build links: edges touching this node
  const links: { edge: Edge; direction: "out" | "in"; otherId: string }[] = [];
  for (const edge of map.edges) {
    if (edge.source === nodeId) links.push({ edge, direction: "out", otherId: edge.target });
    else if (edge.target === nodeId) links.push({ edge, direction: "in", otherId: edge.source });
  }

  const nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  const visibleLinks = showAllLinks ? links : links.slice(0, LINKS_THRESHOLD);
  const hiddenLinks = links.length - LINKS_THRESHOLD;

  const visibleEvidence = showAllEvidence ? node.evidence : node.evidence.slice(0, EVIDENCE_THRESHOLD);
  const hiddenEvidence = node.evidence.length - EVIDENCE_THRESHOLD;

  const typeColor = TYPE_COLOR[node.type] ?? "#6E7378";
  const typeLabel = TYPE_LABEL[node.type] ?? node.type;

  return (
    <div style={panelStyle}>
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close panel"
        style={{
          position: "absolute", top: 12, right: 12,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 20, color: "#5B6570", lineHeight: 1,
        }}
      >×</button>

      {/* Type chip */}
      <div style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        background: typeColor + "22",
        border: `1px solid ${typeColor}55`,
        color: typeColor,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        marginBottom: 8,
      }}>
        {typeLabel}
      </div>

      {/* Label */}
      <h2 style={{
        margin: "0 0 6px",
        fontSize: 18,
        fontWeight: 600,
        color: "#1C2B39",
        lineHeight: 1.3,
        paddingRight: 24,
      }}>
        {node.label}
      </h2>

      {/* Aliases */}
      {node.aliases.length > 0 && (
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#5B6570" }}>
          Also called: {node.aliases.join(", ")}
        </p>
      )}

      {/* Links */}
      {links.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <SectionHeading>Links</SectionHeading>
          {visibleLinks.map(({ edge, direction, otherId }) => {
            const other = nodeById.get(otherId);
            if (!other) return null;
            return (
              <LinkItem
                key={edge.id}
                relation={edge.relation}
                direction={direction}
                otherLabel={other.label}
                otherId={otherId}
                onSelect={onSelect}
              />
            );
          })}
          {!showAllLinks && hiddenLinks > 0 && (
            <ShowAllButton onClick={() => setShowAllLinks(true)}>
              Show all {links.length} links
            </ShowAllButton>
          )}
        </section>
      )}

      {/* Evidence */}
      <section>
        <SectionHeading>Evidence</SectionHeading>
        {visibleEvidence.map((ev, i) => (
          <EvidenceItem key={i} ev={ev} />
        ))}
        {!showAllEvidence && hiddenEvidence > 0 && (
          <ShowAllButton onClick={() => setShowAllEvidence(true)}>
            Show all {node.evidence.length} quotes
          </ShowAllButton>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflowY: "auto",
  padding: "16px 16px 24px",
  boxSizing: "border-box",
  background: "#ffffff",
  fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
};

function EmptyState() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: 24,
      textAlign: "center",
      color: "#5B6570",
      fontSize: 14,
      lineHeight: 1.5,
    }}>
      Select any item on the map to see the exact lines behind it.
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.08em",
      color: "#5B6570",
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function ShowAllButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: "#2F5D8A", fontSize: 13, padding: "4px 0",
        textDecoration: "underline", fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
