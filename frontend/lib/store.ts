/**
 * Module-level map store.
 *
 * The active MapResult is kept here so it survives navigation between
 * the home page and the map page without a router or context provider.
 * On a hard refresh the store is empty and MapPage redirects home —
 * this is intentional: nothing is persisted after the session (US-16).
 */
import type { MapResult } from "./types";

let _map: MapResult | null = null;
let _fromFallback = false;

export function setMap(map: MapResult, fromFallback = false): void {
  _map = map;
  _fromFallback = fromFallback;
}

export function getMap(): MapResult | null {
  return _map;
}

export function isFallback(): boolean {
  return _fromFallback;
}

export function clearMap(): void {
  _map = null;
  _fromFallback = false;
}
