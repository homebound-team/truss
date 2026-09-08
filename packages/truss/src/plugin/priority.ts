/**
 * Computes CSS rule priority using StyleX's priority system.
 *
 * Priority is an additive sum: propertyPriority + pseudoPriority + atRulePriority + pseudoElementPriority.
 * Rules are sorted by this number before emission, guaranteeing longhands beat shorthands,
 * pseudo-classes follow LVFHA order, and at-rules override base styles — all deterministically.
 *
 * Rules that tie on priority, i.e. two `@media` rules for the same property, are ordered by the
 * width interval their query matches, widest first, so the narrower query is emitted later and
 * wins wherever both match. See `compareRuleSortKeys`.
 */

import {
  getPropertyPriority,
  getPseudoClassPriority,
  getAtRulePriority,
  PSEUDO_ELEMENT_PRIORITY,
} from "./property-priorities";
import { WHEN_RELATIONSHIPS } from "./when-relationships";
import type { AtomicRule } from "./emit-css";

/**
 * Compute the numeric priority for a single AtomicRule.
 *
 * I.e. a rule with `declarations: [{ cssProperty: "border-top-color", ... }]`, `pseudoClass: ":hover"`,
 * `mediaQuery: "@media ..."` → 4000 (physical longhand) + 130 (:hover) + 200 (@media) = 4330
 */
export function computeRulePriority(rule: AtomicRule): number {
  let priority = getPropertyPriority(rule.declarations[0].cssProperty);

  if (rule.pseudoElement) {
    priority += PSEUDO_ELEMENT_PRIORITY;
  }

  if (rule.pseudoClass) {
    priority += getPseudoClassPriority(rule.pseudoClass);
  }

  if (rule.mediaQuery) {
    priority += getAtRulePriority(rule.mediaQuery);
  }

  if (rule.whenSelector) {
    const relBase = WHEN_RELATIONSHIPS[rule.whenSelector.relationship].priority;
    const pseudoFraction = getPseudoClassPriority(rule.whenSelector.pseudo) / 100;
    priority += relBase + pseudoFraction;
  }

  // Variable rules get a small bonus (+0.5) so they sort after static rules for the same property
  if (isVariableRule(rule)) {
    priority += 0.5;
  }

  return priority;
}

/** Returns true if this rule uses CSS custom property var() values. */
function isVariableRule(rule: AtomicRule): boolean {
  return rule.declarations.some((d) => d.cssVarName !== undefined);
}

/**
 * The sort key shared by `emit-css` and `merge-css`, so a stylesheet merged from library CSS
 * keeps the same rule order as the per-file output.
 */
export interface RuleSortKey {
  priority: number;
  className: string;
  /** The px widths the rule's media or container query matches, or null when it has no readable interval. */
  widthInterval: WidthInterval | null;
}

/** The inclusive px widths a query matches; `hi` is Infinity for a min-width-only query. */
export interface WidthInterval {
  lo: number;
  hi: number;
}

/** I.e. `ruleSortKey(3200, "lg_black", "@media screen and (min-width: 960px)")` → `widthInterval: { lo: 960, hi: Infinity }`. */
export function ruleSortKey(priority: number, className: string, atRulePrelude: string | undefined): RuleSortKey {
  const widthInterval = atRulePrelude === undefined ? null : parseWidthInterval(atRulePrelude);
  return { priority, className, widthInterval };
}

/**
 * Order rules by priority, then by query width interval, then by class name.
 *
 * Priority ties happen between rules in the same tier for the same property, i.e. two `@media`
 * rules for `color`. Those are ordered widest interval first, so the narrower query is emitted
 * later and wins in the cascade wherever both match. Equal widths go by lower bound ascending,
 * and queries with no readable interval (`print`, `not`, comma lists, non-px units) come last,
 * as they do in StyleX. For one-sided queries this is min-width ascending, then max-width descending.
 *
 * The class-name tiebreak keeps the output fully deterministic regardless of file processing
 * order, which differs between dev HMR and production builds.
 *
 * I.e. `(min-width: 600px)` → `(min-width: 960px)` → `(max-width: 1150px)` → `(max-width: 820px)`
 * → `(min-width: 600px) and (max-width: 959px)` → `print`.
 */
export function compareRuleSortKeys(a: RuleSortKey, b: RuleSortKey): number {
  return (
    a.priority - b.priority ||
    compareWidthIntervals(a.widthInterval, b.widthInterval) ||
    compareClassNames(a.className, b.className)
  );
}

/**
 * Pair each rule with its computed priority and sort with `compareRuleSortKeys`.
 *
 * Priorities and width intervals are computed once upfront so the O(n log n) comparisons are just
 * number/string compares, and callers can reuse the priorities for the `@truss p:` annotations.
 */
export function sortRulesByPriority(rules: Iterable<AtomicRule>): Array<{ rule: AtomicRule; priority: number }> {
  const decorated = Array.from(rules, (rule) => {
    const priority = computeRulePriority(rule);
    return { rule, priority, key: ruleSortKey(priority, rule.className, rule.mediaQuery) };
  });
  decorated.sort((a, b) => compareRuleSortKeys(a.key, b.key));
  return decorated.map((d) => ({ rule: d.rule, priority: d.priority }));
}

/** Code-point order, so identical class sets sort identically in dev and production. */
export function compareClassNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Parse the px width interval a `@media` or `@container` prelude matches.
 *
 * Only `and`-joined `(min-width: Npx)` / `(max-width: Npx)` terms are read. Other features such as
 * `(orientation: landscape)` and media types such as `screen` add no bound, and repeated terms
 * collapse to the effective bound. The result is exact for what it accepts, and null ("no interval")
 * for a prelude with no width term or with anything it cannot read exactly: comma lists, `not`,
 * `or`, range syntax, and non-px units.
 *
 * I.e. `"@media screen and (min-width: 600px) and (max-width: 959px)"` → `{ lo: 600, hi: 959 }`,
 * `"@container grid (min-width: 601px)"` → `{ lo: 601, hi: Infinity }`, `"@media print"` → null.
 */
function parseWidthInterval(prelude: string): WidthInterval | null {
  if (/,|\bnot\b|\bor\b|[<>]/.test(prelude)) return null;
  const terms = Array.from(prelude.matchAll(/\((min|max)-width:\s*([^)]*)\)/g));
  if (terms.length === 0) return null;
  let lo = 0;
  let hi = Infinity;
  for (const term of terms) {
    const px = parsePxLength(term[2]);
    if (px === null) return null;
    if (term[1] === "min") {
      lo = Math.max(lo, px);
    } else {
      hi = Math.min(hi, px);
    }
  }
  return { lo, hi };
}

/** I.e. `"600px"` → 600, `"0"` → 0, `"40rem"` → null. */
function parsePxLength(value: string): number | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(px)?$/);
  if (!match) return null;
  if (match[2] === undefined && Number(match[1]) !== 0) return null;
  return Number(match[1]);
}

/**
 * Widest interval first, equal widths by lower bound ascending, null last.
 *
 * I.e. `{ lo: 600, hi: Infinity }` (width Infinity) → `{ lo: 0, hi: 1150 }` (width 1150)
 * → `{ lo: 600, hi: 959 }` (width 359) → null.
 */
function compareWidthIntervals(a: WidthInterval | null, b: WidthInterval | null): number {
  if (a === null || b === null) {
    return (a === null ? 1 : 0) - (b === null ? 1 : 0);
  }
  const widthA = a.hi - a.lo;
  const widthB = b.hi - b.lo;
  if (widthA !== widthB) return widthA > widthB ? -1 : 1;
  return a.lo - b.lo;
}
