/**
 * StepsLog — collapsible "How this map was made" log.
 * Shows map.steps with t_ms formatted as seconds in IBM Plex Mono.
 */
import { useState } from "react";
import type { Step } from "../../../lib/types";

interface Props {
  steps: Step[];
}

export default function StepsLog({ steps }: Props) {
  const [open, setOpen] = useState(false);

  if (!steps.length) return null;

  return (
    <div style={{ marginTop: 8, fontFamily: '"IBM Plex Sans", system-ui, sans-serif' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#5B6570", fontSize: 12, padding: 0,
          display: "flex", alignItems: "center", gap: 4,
          fontFamily: "inherit",
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: 10 }}>{open ? "▼" : "▶"}</span>
        How this map was made
      </button>

      {open && (
        <ol style={{
          margin: "6px 0 0",
          padding: "0 0 0 0",
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}>
          {steps.map((step, i) => (
            <li key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: 11,
                color: "#B9B4A8",
                flexShrink: 0,
                minWidth: 42,
                textAlign: "right",
              }}>
                {(step.t_ms / 1000).toFixed(1)}s
              </span>
              <span style={{ fontSize: 12, color: "#5B6570" }}>
                {step.message}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
