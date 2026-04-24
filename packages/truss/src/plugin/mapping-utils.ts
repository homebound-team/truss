import { readFileSync } from "fs";
import type { TrussMapping } from "./types";

/** Load a truss mapping file synchronously. */
export function loadMapping(path: string): TrussMapping {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}
