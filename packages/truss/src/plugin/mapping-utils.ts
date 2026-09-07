import { readFileSync } from "fs";
import type { TrussMapping } from "./types";

/** Load a truss mapping file synchronously. */
export function loadMapping(path: string): TrussMapping {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

const longhandCache = new WeakMap<TrussMapping, Map<string, string>>();

/**
 * Reverse lookup from `"cssProperty\0cssValue"` → canonical abbreviation name.
 *
 * I.e. `{ paddingTop: "8px" }` → `"pt1"`, `{ borderStyle: "solid" }` → `"bss"`.
 * Cached per mapping via WeakMap.
 */
export function getLonghandLookup(mapping: TrussMapping): Map<string, string> {
  let lookup = longhandCache.get(mapping);
  if (lookup) return lookup;
  lookup = new Map();
  for (const [abbr, entry] of Object.entries(mapping.abbreviations)) {
    if (entry.kind !== "static") continue;
    const keys = Object.keys(entry.defs);
    if (keys.length !== 1) continue;
    const key = `${keys[0]}\0${entry.defs[keys[0]]}`;
    // First match wins — if multiple abbreviations produce the same declaration,
    // the one that appears first in the mapping is canonical.
    if (!lookup.has(key)) lookup.set(key, abbr);
  }
  longhandCache.set(mapping, lookup);
  return lookup;
}

/** The canonical single-property abbreviation for `{ [cssProp]: cssValue }`, i.e. `("display", "grid")` → `"dg"`. */
export function findCanonicalAbbreviation(
  mapping: TrussMapping,
  cssProp: string,
  cssValue: string,
): string | undefined {
  return getLonghandLookup(mapping).get(`${cssProp}\0${cssValue}`);
}

/** The media query behind a breakpoint getter, i.e. `"ifSm"` → `"@media screen and (max-width: 599px)"`, or null. */
export function breakpointMediaQuery(mapping: TrussMapping, getterName: string): string | null {
  const breakpoints = mapping.breakpoints;
  if (!breakpoints || !Object.hasOwn(breakpoints, getterName)) return null;
  return breakpoints[getterName];
}

/**
 * The breakpoint name behind a media query, without its `if` prefix.
 *
 * I.e. `"@media screen and (max-width: 599px)"` → `"Sm"` when `breakpoints.ifSm` is that query,
 * or null for media queries that are not a configured breakpoint.
 */
export function breakpointNameForMediaQuery(mapping: TrussMapping, mediaQuery: string): string | null {
  const breakpoints = mapping.breakpoints;
  if (!breakpoints) return null;
  const getterName = Object.keys(breakpoints).find((name) => breakpoints[name] === mediaQuery);
  return getterName === undefined ? null : getterName.replace(/^if/, "");
}
