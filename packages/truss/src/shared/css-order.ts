/**
 * The sort key shared by `emit-css`, `merge-css`, and `runtime-css`, so a stylesheet merged from
 * library CSS or assembled rule by rule in jsdom keeps the same rule order as the per-file output.
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

/** Code-point order, so identical class sets sort identically in dev and production. */
export function compareClassNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** I.e. `"@media (min-width: 600px) { .a.a { color: red; } }"` → `"@media (min-width: 600px)"`, or undefined for a plain rule. */
export function atRulePrelude(cssText: string): string | undefined {
  if (!cssText.startsWith("@")) return undefined;
  const brace = cssText.indexOf("{");
  return brace === -1 ? undefined : cssText.slice(0, brace).trim();
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
