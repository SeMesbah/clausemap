/**
 * Compile-time check: the contract example JSON must be assignable to MapResult.
 * Run: npx tsc --noEmit  (from the frontend/ directory)
 * If Dev A's example and Dev B's types disagree, fix it together before 12:10.
 */
import type { MapResult } from "./types";
import example from "../../docs/contract.example.json";

const _check: MapResult = example as MapResult;
export default _check;
