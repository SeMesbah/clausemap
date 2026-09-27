/**
 * HomePage — upload a PDF or open a demo.
 *
 * On success: stores the MapResult in the module store and calls onNavigate.
 */
import { useState, useRef, useEffect } from "react";
import { getDemo, createMap, ApiError } from "../../lib/api";
import { setMap } from "../../lib/store";

// ---------------------------------------------------------------------------
// Progress steps — shown as a vertical list; advance every 12 s, stop at last
// ---------------------------------------------------------------------------
const PROGRESS_MSGS = [
  "Reading pages…",
  "Finding parties and obligations…",
  "Checking every quote against its page…",
  "Merging duplicates…",
  "Drawing the map…",
];

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface Props {
  onNavigate: (page: "map") => void;
}

export default function HomePage({ onNavigate }: Props) {
  const [busy, setBusy] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);   // seconds
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
      if (clockTimer.current) clearInterval(clockTimer.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Progress helpers
  // ---------------------------------------------------------------------------
  function startProgress() {
    setStepIdx(0);
    setElapsed(0);
    startTime.current = Date.now();

    stepTimer.current = setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= PROGRESS_MSGS.length - 1) {
          // Stop at last step
          if (stepTimer.current) clearInterval(stepTimer.current);
          return prev;
        }
        return prev + 1;
      });
    }, 12_000);

    clockTimer.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1_000);
  }

  function stopProgress() {
    if (stepTimer.current) { clearInterval(stepTimer.current); stepTimer.current = null; }
    if (clockTimer.current) { clearInterval(clockTimer.current); clockTimer.current = null; }
  }

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------
  async function handleFile(file: File) {
    setError(null);

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Up to 10 MB for now. Try a shorter document.");
      return;
    }

    setBusy(true);
    startProgress();
    try {
      const map = await createMap(file);
      setMap(map, false);
      onNavigate("map");
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : "Something went wrong. Try again, or open a demo.";
      setError(msg);
    } finally {
      setBusy(false);
      stopProgress();
    }
  }

  // ---------------------------------------------------------------------------
  // Demo handler
  // ---------------------------------------------------------------------------
  async function handleDemo(id: "demo-1" | "demo-2") {
    setError(null);
    setBusy(true);
    try {
      const { map, fromFallback } = await getDemo(id);
      setMap(map, fromFallback);
      onNavigate("map");
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : "Could not load demo. Try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Format timer
  // ---------------------------------------------------------------------------
  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className="page-in"
      style={{
        minHeight: "100vh",
        background: "#F6F3EC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 520, width: "100%" }}>

        {/* Wordmark */}
        <div style={{ fontSize: 13, fontWeight: 600, color: "#5B6570", letterSpacing: "0.08em", marginBottom: 20 }}>
          clausemap
        </div>

        {/* Headline */}
        <h1 style={{
          margin: "0 0 12px",
          fontSize: "clamp(28px, 6vw, 44px)",
          fontWeight: 600,
          color: "#1C2B39",
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
        }}>
          See the whole deal.<br />Cite every line.
        </h1>

        {/* Sub-copy */}
        <p style={{ margin: "0 0 32px", fontSize: 16, color: "#5B6570", lineHeight: 1.6 }}>
          Upload a contract or report and get a map of who owes what to whom, by when —
          every node linked to the exact sentence it came from.
        </p>

        {/* Upload area */}
        <div
          role="button"
          tabIndex={0}
          aria-disabled={busy}
          onClick={() => !busy && fileInputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) fileInputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) {
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }
          }}
          style={{
            border: `2px dashed ${dragging ? "#C8501C" : busy ? "#B9B4A8" : "#5B6570"}`,
            borderRadius: 8,
            padding: "28px 24px",
            textAlign: "center",
            cursor: busy ? "not-allowed" : "pointer",
            background: dragging ? "#FDF0E8" : busy ? "#F0EDE6" : "#FDFAF4",
            transition: "border-color 0.15s, background 0.15s",
            marginBottom: 8,
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.outline = "2px solid #1C2B39")}
          onBlur={(e) => (e.currentTarget.style.outline = "none")}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: "none" }}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          {busy ? (
            /* Progress stepper */
            <div style={{ textAlign: "left" }}>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {PROGRESS_MSGS.map((msg, i) => {
                  const isDone    = i < stepIdx;
                  const isCurrent = i === stepIdx;
                  return (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                        color: isCurrent ? "#1C2B39" : "#5B6570",
                        fontWeight: isCurrent ? 600 : 400,
                      }}
                    >
                      {/* Indicator */}
                      {isDone ? (
                        <span style={{ color: "#2A7A74", fontSize: 13, flexShrink: 0 }}>✓</span>
                      ) : isCurrent ? (
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: "#C8501C", flexShrink: 0, display: "inline-block",
                          animation: "pulse 1.2s ease-in-out infinite",
                        }} />
                      ) : (
                        <span style={{ width: 8, height: 8, display: "inline-block", flexShrink: 0 }} />
                      )}
                      {msg}
                    </li>
                  );
                })}
              </ol>

              {/* Timer */}
              <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 16, color: "#1C2B39", fontWeight: 600 }}>
                  {formatTime(elapsed)}
                </span>
                <span style={{ fontSize: 12, color: "#5B6570" }}>Usually 30–90 seconds.</span>
              </div>
            </div>
          ) : (
            <>
              {/* PDF icon — page outline with orange fold triangle */}
              <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden style={{ marginBottom: 8 }}>
                <rect x="4" y="1" width="20" height="26" rx="2" fill="none" stroke="#5B6570" strokeWidth="1.5"/>
                <path d="M18 1 L24 7 L18 7 Z" fill="#C8501C"/>
                <line x1="8" y1="13" x2="20" y2="13" stroke="#B9B4A8" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="8" y1="17" x2="20" y2="17" stroke="#B9B4A8" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="8" y1="21" x2="16" y2="21" stroke="#B9B4A8" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1C2B39" }}>
                {dragging ? "Drop it here" : "Drop a PDF here or choose a file"}
              </div>
              <div style={{ fontSize: 13, color: "#5B6570", marginTop: 4 }}>
                Up to 10 MB · text-based PDFs only
              </div>
            </>
          )}
        </div>

        {/* Privacy line */}
        <p style={{ margin: "0 0 24px", fontSize: 12, color: "#5B6570", lineHeight: 1.5 }}>
          Your PDF is sent to OpenAI to read it. Nothing is kept after your map is built.
        </p>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 20,
            padding: "10px 14px",
            borderRadius: 6,
            background: "#FBEFEC",
            borderLeft: "3px solid #A1302A",
            color: "#1C2B39",
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "#B9B4A8" }} />
          <span style={{ fontSize: 12, color: "#5B6570" }}>or try a demo</span>
          <div style={{ flex: 1, height: 1, background: "#B9B4A8" }} />
        </div>

        {/* Demo buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(["demo-1", "demo-2"] as const).map((id) => (
            <DemoButton
              key={id}
              id={id}
              busy={busy}
              onClick={() => handleDemo(id)}
            />
          ))}
        </div>

      </div>

      {/* Pulse keyframe */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DemoButton
// ---------------------------------------------------------------------------
interface DemoButtonProps {
  id: "demo-1" | "demo-2";
  busy: boolean;
  onClick: () => void;
}
function DemoButton({ id, busy, onClick }: DemoButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const active = !busy && (hovered || focused);

  return (
    <button
      disabled={busy}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        flex: "1 1 200px",
        padding: "12px 16px",
        borderRadius: 6,
        border: `1px solid ${active ? "#1C2B39" : "#B9B4A8"}`,
        background: busy ? "#F0EDE6" : "#ffffff",
        color: busy ? "#5B6570" : "#1C2B39",
        fontSize: 14,
        fontWeight: 500,
        cursor: busy ? "not-allowed" : "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transform: active ? "translateY(-1px)" : "none",
        boxShadow: active ? "0 2px 8px rgb(28 43 57 / 0.08)" : "none",
        transition: "border-color 120ms, transform 120ms, box-shadow 120ms",
        outline: focused ? "2px solid #1C2B39" : "none",
        outlineOffset: 2,
      }}
    >
      <span style={{ display: "block", fontSize: 11, color: "#5B6570", marginBottom: 2 }}>
        Demo {id === "demo-1" ? "1" : "2"}
      </span>
      {id === "demo-1"
        ? "Supply Agreement — TechCorp / Meridian"
        : "Services Agreement — Sample Document"}
    </button>
  );
}
