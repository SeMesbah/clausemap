/**
 * HomePage — upload a PDF or open a demo.
 *
 * On success: stores the MapResult in the module store and sets the
 * page to "map" via the onNavigate callback.
 */
import { useState, useRef } from "react";
import { getDemo, createMap, ApiError } from "../../lib/api";
import { setMap } from "../../lib/store";

// ---------------------------------------------------------------------------
// Progress messages cycling every 4 seconds during upload
// ---------------------------------------------------------------------------
const PROGRESS_MSGS = [
  "Reading pages…",
  "Finding parties and obligations…",
  "Checking every quote against its page…",
  "Merging duplicates…",
  "Drawing the map…",
];

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — mirrors the backend limit

interface Props {
  onNavigate: (page: "map") => void;
}

export default function HomePage({ onNavigate }: Props) {
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState(PROGRESS_MSGS[0]);
  const [error, setError] = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function startProgress() {
    let idx = 0;
    setProgressMsg(PROGRESS_MSGS[0]);
    progressTimer.current = setInterval(() => {
      idx = (idx + 1) % PROGRESS_MSGS.length;
      setProgressMsg(PROGRESS_MSGS[idx]);
    }, 4_000);
  }

  function stopProgress() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Upload handler
  // ---------------------------------------------------------------------------
  async function handleFile(file: File) {
    setError(null);

    // Client-side checks (UX only — backend enforces too)
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
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F6F3EC",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 520, width: "100%" }}>

        {/* Wordmark */}
        <div style={{ fontSize: 13, fontWeight: 600, color: "#5B6570", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>
          Clausemap
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
          style={{
            border: `2px dashed ${busy ? "#B9B4A8" : "#5B6570"}`,
            borderRadius: 8,
            padding: "28px 24px",
            textAlign: "center",
            cursor: busy ? "not-allowed" : "pointer",
            background: busy ? "#F0EDE6" : "#FDFAF4",
            transition: "border-color 0.15s",
            marginBottom: 8,
          }}
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
              e.target.value = "";          // allow re-selecting same file
            }}
          />
          {busy ? (
            <span style={{ fontSize: 15, color: "#5B6570" }}>{progressMsg}</span>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1C2B39" }}>
                Choose a PDF
              </div>
              <div style={{ fontSize: 13, color: "#5B6570", marginTop: 4 }}>
                Up to 10 MB · text-based PDFs only
              </div>
            </>
          )}
        </div>

        {/* Privacy line */}
        <p style={{ margin: "0 0 24px", fontSize: 12, color: "#B9B4A8", lineHeight: 1.5 }}>
          Your PDF is sent to OpenAI to read it. Nothing is kept after your map is built.
        </p>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 20,
            padding: "10px 14px",
            borderRadius: 6,
            background: "#FDE8E0",
            border: "1px solid #C8501C44",
            color: "#C8501C",
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "#B9B4A8" }} />
          <span style={{ fontSize: 12, color: "#B9B4A8" }}>or try a demo</span>
          <div style={{ flex: 1, height: 1, background: "#B9B4A8" }} />
        </div>

        {/* Demo buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(["demo-1", "demo-2"] as const).map((id) => (
            <button
              key={id}
              disabled={busy}
              onClick={() => handleDemo(id)}
              style={{
                flex: "1 1 200px",
                padding: "12px 16px",
                borderRadius: 6,
                border: "1px solid #B9B4A8",
                background: busy ? "#F0EDE6" : "#ffffff",
                color: busy ? "#B9B4A8" : "#1C2B39",
                fontSize: 14,
                fontWeight: 500,
                cursor: busy ? "not-allowed" : "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "background 0.12s",
              }}
            >
              <span style={{ display: "block", fontSize: 11, color: "#5B6570", marginBottom: 2 }}>
                Demo {id === "demo-1" ? "1" : "2"}
              </span>
              {id === "demo-1"
                ? "Supply Agreement — TechCorp / Meridian"
                : "Services Agreement — Sample Document"}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
