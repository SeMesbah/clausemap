/**
 * API client for Clausemap.
 * This is the ONLY file that calls the backend. All other code imports from here.
 *
 * Env var: VITE_API_BASE_URL  (e.g. https://clausemap-api.fly.dev)
 * Falls back to the same origin when the var is not set.
 */
import type { MapResult } from "./types";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? "").replace(/\/$/, "");

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function _parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    const err = body?.error;
    if (err?.code && err?.message) {
      return new ApiError(err.code, err.message);
    }
  } catch {
    // ignore JSON parse failure
  }
  return new ApiError("unknown_error", "Something went wrong. Try again, or open a demo.");
}

// ---------------------------------------------------------------------------
// getDemo
// ---------------------------------------------------------------------------

export async function getDemo(
  id: "demo-1" | "demo-2",
): Promise<{ map: MapResult; fromFallback: boolean }> {
  // Try live backend with an 8-second timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(`${BASE}/api/v1/demo/${id}`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const map = (await res.json()) as MapResult;
      return { map, fromFallback: false };
    }
  } catch {
    clearTimeout(timer);
    // Network error or timeout — fall through to bundled fallback
  }

  // Fallback: bundled fixture file (always works, even offline)
  const fallbackRes = await fetch(`/fixtures/${id}.json`);
  if (!fallbackRes.ok) throw new ApiError("not_found", `Demo "${id}" could not be loaded.`);
  const map = (await fallbackRes.json()) as MapResult;
  return { map, fromFallback: true };
}

// ---------------------------------------------------------------------------
// createMap
// ---------------------------------------------------------------------------

export async function createMap(file: File): Promise<MapResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1/maps`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("timeout", "Processing took too long. Try a shorter document.");
    }
    throw new ApiError("network_error", "Could not reach the server. Check your connection.");
  }

  if (!res.ok) {
    throw await _parseError(res);
  }

  return (await res.json()) as MapResult;
}
