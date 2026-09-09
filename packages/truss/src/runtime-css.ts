import { atRulePrelude, compareClassNames, compareRuleSortKeys, ruleSortKey, type RuleSortKey } from "./css-order";
import { parseTrussCss } from "./truss-css";

interface InjectionOptions {
  /** Canonical source path for ordering and deduplicating application arbitrary CSS. */
  source?: string;
  /** Libraries use 0 and application modules use 1, matching the production merge. */
  order?: number;
  prelude?: string;
}

interface InstalledRule {
  id: string;
  cssText: string;
  /** Prelude, atomic rules, property declarations, then arbitrary CSS. */
  section: 0 | 1 | 2 | 3;
  key: RuleSortKey | null;
  order: number;
  source: string;
  sequence: number;
  position: number;
}

interface InjectionState {
  sheet: CSSStyleSheet;
  rules: InstalledRule[];
  byId: Map<string, InstalledRule>;
  chunks: Set<string>;
  sources: Map<string, number>;
}

type TrussStyleElement = HTMLStyleElement & { __trussCssState__?: InjectionState };
let trussStyleElement: TrussStyleElement | null = null;

/**
 * Register annotated module or library CSS in the document's ordered test stylesheet.
 *
 * Annotated atomic rules are deduplicated by class and inserted with the production
 * comparator, regardless of module execution order. Library definitions take precedence
 * over application definitions of the same class. Arbitrary blocks stay after atomics,
 * in library order followed by canonical application source path order. The plugin
 * supplies spacing explicitly through options.prelude; unannotated CSS is ignored.
 *
 * Rules live until the document is discarded, not until a component unmounts. Repeated
 * imports reuse state on the style element. This is not HMR: within one source rank,
 * the first definition wins and omitted rules are not removed. Browser dev HMR replaces
 * its separate virtual stylesheet; useRuntimeStyle owns transient sheets after this one.
 *
 * Only new or replaced rules are parsed by CSSOM. I.e. a late priority-1000 shorthand
 * is inserted before an existing priority-4000 longhand without reparsing that longhand.
 */
export function __injectTrussCSS(cssText: string, options: InjectionOptions = {}): void {
  if (typeof document === "undefined" || (!cssText && !options.prelude)) return;
  const style = getOrCreateTrussStyleElement();
  const sheet = style.sheet;
  if (!sheet) throw new Error("Truss could not create its test stylesheet.");
  // A removed and reattached style element has a new CSSOM sheet, even in the same document.
  if (style.__trussCssState__?.sheet !== sheet) {
    style.__trussCssState__ = { sheet, rules: [], byId: new Map(), chunks: new Set(), sources: new Map() };
  }
  const state = style.__trussCssState__!;
  const chunkId = JSON.stringify([options.source, options.order, options.prelude, cssText]);
  if (state.chunks.has(chunkId)) return;
  const sourceId = options.source ?? cssText;
  if (!state.sources.has(sourceId)) state.sources.set(sourceId, state.sources.size);
  const base = {
    order: options.order ?? 1,
    source: options.source ?? "",
    sequence: state.sources.get(sourceId)!,
    position: 0,
    key: null,
  };
  const parsed = parseTrussCss(cssText);
  try {
    if (options.prelude) {
      installRule(state, { ...base, id: "prelude", section: 0, cssText: options.prelude });
    }
    for (const rule of parsed.rules) {
      installRule(state, {
        ...base,
        id: `class:${rule.className}`,
        section: 1,
        cssText: rule.cssText,
        key: ruleSortKey(rule.priority, rule.className, atRulePrelude(rule.cssText)),
      });
    }
    for (const property of parsed.properties) {
      installRule(state, { ...base, id: `property:${property.varName}`, section: 2, cssText: property.cssText });
    }
    let position = 0;
    for (const block of parsed.arbitraryCssBlocks) {
      for (const text of parseArbitraryRules(block.cssText)) {
        installRule(state, {
          ...base,
          id: `arbitrary:${base.sequence}:${position}`,
          section: 3,
          position: position++,
          cssText: text,
        });
      }
    }
    state.chunks.add(chunkId);
  } finally {
    // jsdom 29 does not invalidate computed styles after insertRule/deleteRule. An attribute
    // mutation clears that cache without replacing the sheet or reparsing its previous rules.
    style.setAttribute("data-truss", "");
  }
}

/** Insert a unique rule at its production sort position; lower source ranks can replace it. */
function installRule(state: InjectionState, rule: InstalledRule): void {
  const previous = state.byId.get(rule.id);
  if (previous && previous.order <= rule.order) return;
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
    // jsdom silently skips @property when parsing style text, but insertRule throws.
    // Do not swallow errors for atomic rules or corrupt the installed-rule indexes.
    if (
      rule.section === 2 &&
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "SyntaxError"
    )
      return;
    throw error;
  }
  state.rules.splice(lo, 0, rule);
  state.byId.set(rule.id, rule);
  if (previous) {
    const oldIndex = state.rules.indexOf(previous);
    state.sheet.deleteRule(oldIndex);
    state.rules.splice(oldIndex, 1);
  }
}

/** Use the production atomic comparator and preserve source order within opaque blocks. */
function compareInstalledRules(a: InstalledRule, b: InstalledRule): number {
  if (a.section !== b.section) return a.section - b.section;
  if (a.key && b.key) return compareRuleSortKeys(a.key, b.key);
  return (
    a.order - b.order || compareClassNames(a.source, b.source) || a.sequence - b.sequence || a.position - b.position
  );
}

/** Parse only the new opaque block, preserving CSS parser recovery for unsupported rules. */
function parseArbitraryRules(cssText: string): string[] {
  // jsdom does not create sheets in detached documents. Remove this temporary sheet
  // synchronously before returning; no earlier static rules are reparsed.
  const style = document.createElement("style");
  style.textContent = cssText;
  document.head.appendChild(style);
  try {
    return Array.from(style.sheet?.cssRules ?? [], (rule) => rule.cssText);
  } finally {
    style.remove();
  }
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
