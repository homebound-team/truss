/** Pseudo-class getter methods supported by CssBuilder chains. */
export const TRUSS_PSEUDO_METHODS: Readonly<Record<string, string>> = {
  onHover: ":hover",
  onFocus: ":focus",
  onFocusVisible: ":focus-visible",
  onFocusWithin: ":focus-within",
  onActive: ":active",
  onDisabled: ":disabled",
  ifFirstOfType: ":first-of-type",
  ifLastOfType: ":last-of-type",
};

/** Compact class-name prefixes for pseudo selectors. */
const PSEUDO_SELECTOR_PREFIXES: Readonly<Record<string, string>> = {
  ":hover": "h",
  ":focus": "f",
  ":focus-visible": "fv",
  ":focus-within": "fw",
  ":active": "a",
  ":disabled": "d",
  ":first-of-type": "fot",
  ":last-of-type": "lot",
  ":not": "n",
  ":is": "is",
  ":where": "where",
  ":has": "has",
};

export function isTrussPseudoMethod(name: string): boolean {
  return name in TRUSS_PSEUDO_METHODS;
}

export function trussPseudoSelector(name: string): string {
  return TRUSS_PSEUDO_METHODS[name];
}

/** I.e. `":hover:not(:disabled)"` -> `"h_n_d"`. */
export function pseudoSelectorPrefix(pseudo: string): string {
  const replaced = pseudo.trim().replace(/::?[a-zA-Z-]+/g, function pseudoMatchToPrefix(match) {
    return `_${pseudoIdentifierPrefix(match)}_`;
  });
  const cleaned = replaced
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned || "pseudo";
}

/** I.e. `":hover"` -> `"h"`, `":focus-visible"` -> `"fv"`. */
function pseudoIdentifierPrefix(pseudo: string): string {
  const normalized = normalizePseudoIdentifier(pseudo);
  const known = PSEUDO_SELECTOR_PREFIXES[normalized];
  if (known) {
    return known;
  }
  return normalized.replace(/^::?/, "").replace(/-/g, "_");
}

/** I.e. `":focusVisible"` -> `":focus-visible"`. */
function normalizePseudoIdentifier(pseudo: string): string {
  const prefixMatch = pseudo.match(/^::?/);
  const prefix = prefixMatch?.[0] ?? "";
  const name = pseudo.slice(prefix.length).replace(/[A-Z]/g, function upperToKebab(match) {
    return `-${match.toLowerCase()}`;
  });
  return `${prefix}${name}`;
}
