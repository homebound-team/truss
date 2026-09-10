import { compareClassNames, compareRuleSortKeys, ruleSortKey, type RuleSortKey } from "./css-order";
import type { TestCssPayload } from "./test-css";

interface InstalledRule {
  id: string;
  cssText: string;
  /** Prelude, atomic rules, property declarations, then arbitrary CSS. */
  section: 0 | 1 | 2 | 3;
  key: RuleSortKey | null;
  order: number;
  source: string;
  position: number;
}

interface InjectionState {
  sheet: CSSStyleSheet;
  rules: InstalledRule[];
  byId: Map<string, InstalledRule>;
}

type TrussStyleElement = HTMLStyleElement & { __trussCssState__?: InjectionState };
let trussStyleElement: TrussStyleElement | null = null;

/**
 * Register structured module or library CSS in the document's ordered test stylesheet.
 *
 * Atomic rules are deduplicated by class and inserted with the production
 * comparator, regardless of module execution order. Library definitions take precedence
 * over application definitions of the same class. Arbitrary blocks stay after atomics,
 * in library order followed by canonical application source path order. The plugin supplies
 * rule identities, query metadata, spacing, and complete top-level arbitrary rules. The
 * runtime does not parse annotations, split CSS blocks, or serialize payloads for dedupe.
 *
 * Rules live until the document is discarded, not until a component unmounts. Repeated
 * imports reuse state on the style element. This is not HMR: within one source rank,
 * the first definition wins and omitted rules are not removed. Browser dev HMR replaces
 * its separate virtual stylesheet; useRuntimeStyle owns transient sheets after this one.
 *
 * Only new or replaced rules are parsed by CSSOM. I.e. a late priority-1000 shorthand
 * is inserted before an existing priority-4000 longhand without reparsing that longhand.
 */
export function __injectTrussCSS(payload: TestCssPayload): void {
  if (
    typeof document === "undefined" ||
    (!payload.rules?.length && !payload.properties?.length && !payload.arbitraryRules?.length && !payload.prelude)
  )
    return;
  if (payload.arbitraryRules?.length && !payload.source) {
    throw new Error("Truss arbitrary CSS requires a source identity.");
  }
  const style = getOrCreateTrussStyleElement();
  const sheet = style.sheet;
  if (!sheet) throw new Error("Truss could not create its test stylesheet.");
  // A removed and reattached style element has a new CSSOM sheet, even in the same document.
  if (style.__trussCssState__?.sheet !== sheet) {
    style.__trussCssState__ = { sheet, rules: [], byId: new Map() };
  }
  const state = style.__trussCssState__!;
  const base = {
    order: payload.order ?? 1,
    source: payload.source ?? "",
    position: 0,
    key: null,
  };
  let changed = false;
  try {
    if (payload.prelude) {
      changed = installRule(state, { ...base, id: "prelude", section: 0, cssText: payload.prelude }) || changed;
    }
    for (const rule of payload.rules ?? []) {
      changed =
        installRule(state, {
          ...base,
          id: `class:${rule.className}`,
          section: 1,
          cssText: rule.cssText,
          key: ruleSortKey(rule.priority, rule.className, rule.atRule),
        }) || changed;
    }
    for (const property of payload.properties ?? []) {
      changed =
        installRule(state, { ...base, id: `property:${property.varName}`, section: 2, cssText: property.cssText }) ||
        changed;
    }
    for (const [position, cssText] of (payload.arbitraryRules ?? []).entries()) {
      changed =
        installRule(state, {
          ...base,
          id: `arbitrary:${payload.source}:${position}`,
          section: 3,
          position,
          cssText,
        }) || changed;
    }
  } finally {
    // jsdom 29 does not invalidate computed styles after insertRule/deleteRule. An attribute
    // mutation clears that cache without replacing the sheet or reparsing its previous rules.
    if (changed) style.setAttribute("data-truss", "");
  }
}

/**
 * Insert a unique rule at its production sort position and report whether the sheet changed.
 * Lower source ranks can replace existing definitions. Unsupported declarations are registered
 * for dedupe without taking a CSSOM index; invalid atomic rules still throw and can be retried.
 */
function installRule(state: InjectionState, rule: InstalledRule): boolean {
  const previous = state.byId.get(rule.id);
  if (previous && previous.order <= rule.order) return false;
  let lo = 0;
  let hi = state.rules.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareInstalledRules(state.rules[mid], rule) <= 0) lo = mid + 1;
    else hi = mid;
  }
  try {
    state.sheet.insertRule(rule.cssText, lo);
  } catch (error) {
    // jsdom silently skips unsupported property/arbitrary at-rules in style text, but insertRule throws.
    // Do not swallow errors for atomic rules or corrupt the installed-rule indexes.
    if (
      rule.section >= 2 &&
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "SyntaxError"
    ) {
      // Do not replace an installed definition with one the browser cannot parse.
      if (!previous || !state.rules.includes(previous)) state.byId.set(rule.id, rule);
      return false;
    }
    throw error;
  }
  state.rules.splice(lo, 0, rule);
  state.byId.set(rule.id, rule);
  if (previous) {
    const oldIndex = state.rules.indexOf(previous);
    if (oldIndex !== -1) {
      state.sheet.deleteRule(oldIndex);
      state.rules.splice(oldIndex, 1);
    }
  }
  return true;
}

/** Use the production atomic comparator and preserve source order within opaque blocks. */
function compareInstalledRules(a: InstalledRule, b: InstalledRule): number {
  if (a.section !== b.section) return a.section - b.section;
  if (a.key && b.key) return compareRuleSortKeys(a.key, b.key);
  return a.order - b.order || compareClassNames(a.source, b.source) || a.position - b.position;
}

/** Keep one static sheet before transient runtime styles, and recover after document replacement. */
export function getOrCreateTrussStyleElement(): TrussStyleElement {
  if (trussStyleElement?.ownerDocument === document && trussStyleElement.isConnected) return trussStyleElement;
  const style = document.querySelector<TrussStyleElement>("style[data-truss]") ?? document.createElement("style");
  if (!style.isConnected) {
    style.setAttribute("data-truss", "");
    document.head.insertBefore(style, document.head.querySelector("style[data-truss-runtime-style]"));
  }
  trussStyleElement = style;
  return style;
}
