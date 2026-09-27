/**
 * AskBox — "Ask the map" chat panel component (Phase U2).
 *
 * Design principles:
 *  - Paper background, ink text, Plex Sans — no purple (brand)
 *  - Answer + citations in Plex Sans / Source Serif; reuses EvidenceItem style
 *  - Loading: pulsing orange dot + "Reading the map…"
 *  - Errors in U1 error style
 *  - Last 5 Q&As kept in component state only — nothing persisted
 *  - Rendered as React text only — no dangerouslySetInnerHTML (A03)
 */
import { useState, useRef, useEffect } from "react";
import type { AskResponse, AskCitation, MapResult } from "../../../lib/types";
import { ask, ApiError } from "../../../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QA {
  question: string;
  response: AskResponse;
}

interface Props {
  map: MapResult;
  /** Called when the user gets an answer — pass the node/edge ids to highlight */
  onHighlight: (nodeIds: Set<string>, edgeIds: Set<string>) => void;
  /** Called when the user clears or the ask box wants to remove highlighting */
  onClearHighlight: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CitationItem({ citation }: { citation: AskCitation }) {
  return (
    <blockquote style={{
      margin: "0 0 8px",
      padding: "8px 10px",
      background: "#F2E3A0",
      borderRadius: 4,
      borderLeft: "3px solid #9A6B12",
    }}>
      <span style={{
        display: "block",
        fontFamily: '"Source Serif 4", Georgia, serif',
        fontSize: 13,
        lineHeight: 1.5,
        color: "#1C2B39",
        fontStyle: "italic",
      }}>
        "{citation.quote}"
      </span>
      <span style={{
        display: "block",
        marginTop: 4,
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 11,
        color: "#5B6570",
      }}>
        p.{citation.page} · verified
      </span>
    </blockquote>
  );
}

function LoadingDot() {
  return (
    <span style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: "#C8501C",
      marginRight: 8,
      animation: "ask-pulse 1s ease-in-out infinite",
    }} />
  );
}

// ---------------------------------------------------------------------------
// AskBox
// ---------------------------------------------------------------------------

const MAX_HISTORY = 5;

export default function AskBox({ map, onHighlight, onClearHighlight }: Props) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QA[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when history grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setError(null);
    setLoading(true);
    onClearHighlight();

    try {
      const response = await ask(q, map);
      setHistory((prev) => {
        const next = [...prev, { question: q, response }].slice(-MAX_HISTORY);
        return next;
      });
      setQuestion("");
      // Highlight the ids returned
      onHighlight(
        new Set(response.node_ids),
        new Set(response.edge_ids),
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setHistory([]);
    setQuestion("");
    setError(null);
    onClearHighlight();
  }

  const hasHistory = history.length > 0;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      borderTop: "1px solid #B9B4A8",
      background: "#ffffff",
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
    }}>
      {/* Pulse animation — injected once */}
      <style>{`
        @keyframes ask-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* History */}
      {hasHistory && (
        <div style={{
          maxHeight: 360,
          overflowY: "auto",
          padding: "12px 16px 4px",
        }}>
          {history.map((qa, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              {/* Question */}
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1C2B39",
                marginBottom: 6,
              }}>
                {qa.question}
              </div>

              {/* Answer */}
              <div style={{
                fontSize: 14,
                color: "#1C2B39",
                lineHeight: 1.6,
                marginBottom: 8,
              }}>
                {qa.response.answer}
              </div>

              {/* Citations */}
              {qa.response.citations.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  {qa.response.citations.map((c, j) => (
                    <CitationItem key={j} citation={c} />
                  ))}
                </div>
              )}

              {/* Dropped citations notice */}
              {qa.response.dropped_citations > 0 && (
                <p style={{ margin: "0 0 4px", fontSize: 12, color: "#5B6570" }}>
                  {qa.response.dropped_citations} quote{qa.response.dropped_citations !== 1 ? "s" : ""} left out: not found on the map.
                </p>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ padding: "8px 16px", fontSize: 13, color: "#5B6570", display: "flex", alignItems: "center" }}>
          <LoadingDot />
          Reading the map…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          margin: "8px 16px",
          padding: "8px 12px",
          borderRadius: 4,
          background: "#FBEFEC",
          borderLeft: "3px solid #A1302A",
          color: "#1C2B39",
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 12px",
          borderTop: hasHistory || loading || error ? "1px solid #B9B4A8" : "none",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this document…"
          maxLength={300}
          disabled={loading}
          style={{
            flex: 1,
            fontSize: 13,
            padding: "6px 10px",
            border: "1px solid #B9B4A8",
            borderRadius: 4,
            background: "#FDFAF4",
            color: "#1C2B39",
            fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            outline: "none",
            opacity: loading ? 0.6 : 1,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#1C2B39")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#B9B4A8")}
        />

        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            background: "#C8501C",
            color: "#ffffff",
            border: "none",
            borderRadius: 4,
            cursor: loading || !question.trim() ? "default" : "pointer",
            fontFamily: "inherit",
            opacity: loading || !question.trim() ? 0.5 : 1,
            transition: "opacity 120ms",
          }}
        >
          Ask
        </button>

        {hasHistory && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              fontSize: 12,
              color: "#5B6570",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px 4px",
              fontFamily: "inherit",
              textDecoration: "underline",
            }}
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
