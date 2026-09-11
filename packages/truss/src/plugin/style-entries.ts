import * as t from "@babel/types";
import type { CssSegment, ResolvedConditionContext, TrussMapping, VariableSegment, WhenCondition } from "./types";
import { breakpointNameForMediaQuery, findCanonicalAbbreviation } from "./mapping-utils";
import { cssPropertyAbbreviations } from "./css-property-abbreviations";
import { WHEN_RELATIONSHIPS } from "./when-relationships";
import { pseudoSelectorPrefix } from "../pseudo-selectors";
import { tryParseIncrementCalcMultiplier } from "../spacing-css-var";

/**
 * One class/property pair derived from a segment; the shared model both CSS rules (emit-css)
 * and style hashes (emit-style-hash) consume.
 */
export interface StyleEntry {
  cssProp: string;
  className: string;
  isVariable: boolean;
  /** Whether this entry has a condition prefix (pseudo/media/when). */
  isConditional: boolean;
  /** Concrete CSS declaration value for emitted CSS rules. */
  cssValue: string;
  varName?: string;
  argNode?: t.Expression;
  /** Compile-time resolved tuple value for `_var` segments (e.g. `"var(--theme-accent)"`). */
  argResolved?: string;
  incremented?: boolean;
  appendPx?: boolean;
}

// ── Marker class helpers ──────────────────────────────────────────────

/** I.e. the shared default marker class is `_mrk`. */
export const DEFAULT_MARKER_CLASS = "_mrk";

/** I.e. `markerClassName(row)` → `"_row_mrk"`, `markerClassName()` → `"_mrk"`. */
export function markerClassName(markerNode?: t.Expression): string {
  if (!markerNode) return DEFAULT_MARKER_CLASS;
  if (t.isIdentifier(markerNode)) return `_${markerNode.name}_mrk`;
  return "_marker_mrk";
}

// ── Style entries ─────────────────────────────────────────────────────

/**
 * Build normalized class/property entries from a segment for CSS and AST emitters.
 *
 * I.e. convert one resolved segment into the shared model both CSS rules and style hashes consume.
 */
export function styleEntriesForSegment(seg: CssSegment, mapping: TrussMapping): StyleEntry[] {
  const prefix = segmentClassPrefix(seg.condition, mapping);
  const isConditional = prefix !== "";

  if (seg.kind === "variable") {
    return variableStyleEntries(seg, mapping, prefix, isConditional);
  }

  return staticStyleEntries(seg, mapping, prefix, isConditional, seg.defs);
}

/**
 * Build entries for concrete CSS defs.
 *
 * I.e. `Css.ba.$` becomes separate `borderStyle -> bss` and `borderWidth -> bw1` entries.
 */
function staticStyleEntries(
  seg: CssSegment,
  mapping: TrussMapping,
  prefix: string,
  isConditional: boolean,
  defs: Record<string, unknown>,
  forceLonghandNames = false,
): StyleEntry[] {
  const isMultiProp = forceLonghandNames || Object.keys(defs).length > 1;

  return Object.entries(defs).map(([cssProp, value]) => {
    const cssValue = String(value);
    const baseName = computeStaticBaseName(seg, cssProp, cssValue, isMultiProp, mapping);
    return { cssProp, className: `${prefix}${baseName}`, isVariable: false, isConditional, cssValue };
  });
}

/**
 * Build entries for runtime variable CSS defs.
 *
 * I.e. `Css.mt(x).$` becomes `marginTop -> mt_var` plus `--marginTop` metadata,
 * and `Css.ifSm.mt(x).$` becomes `sm_mt_var` with `--sm_marginTop`.
 */
function variableStyleEntries(
  seg: VariableSegment,
  mapping: TrussMapping,
  prefix: string,
  isConditional: boolean,
): StyleEntry[] {
  const className = `${prefix}${seg.abbr}_var`;
  const entries: StyleEntry[] = seg.props.map((cssProp) => {
    const varName = `--${prefix}${cssProp}`;
    return {
      cssProp,
      className,
      isVariable: true,
      isConditional,
      cssValue: `var(${varName})`,
      varName,
      argNode: seg.argNode,
      argResolved: seg.argResolved,
      incremented: seg.incremented,
      appendPx: seg.appendPx,
    };
  });

  if (seg.extraDefs) {
    entries.push(...staticStyleEntries(seg, mapping, prefix, isConditional, seg.extraDefs, true));
  }

  return entries;
}

/**
 * Compute the base class name for a static segment.
 *
 * For multi-property abbreviations, looks up the canonical single-property
 * abbreviation name so classes are maximally reused.
 * I.e. `p1` → `pt1`, `pr1`, `pb1`, `pl1` (not `p1_paddingTop`, etc.)
 * I.e. `ba` → `bss`, `bw1` (not `ba_borderStyle`, etc.)
 * I.e. `lineClamp("3")` display:-webkit-box → `d_negwebkit_box`, not `d_3`
 *
 * For literal-folded variables (argResolved set), includes the value:
 * I.e. `mt(2)` → `mt_2` (web increment calc), `mt(-1)` → `mt_neg1`, `bc("red")` → `bc_red`.
 * A base name that is itself a CSS property name is abbreviated too, so the single-property path
 * names a declaration the same way the multi-property path does.
 * I.e. `letterSpacing("-0.022em")` → `ls_neg0_022em`, `add("borderBottomStyle", "solid")` → `bbs_solid`.
 */
function computeStaticBaseName(
  seg: CssSegment,
  cssProp: string,
  cssValue: string,
  isMultiProp: boolean,
  mapping: TrussMapping,
): string {
  if (isMultiProp) {
    const canonical = findCanonicalAbbreviation(mapping, cssProp, cssValue);
    return canonical ?? `${getPropertyAbbreviation(cssProp)}_${classNameFragmentForResolvedValue(cssValue)}`;
  }
  if (seg.argResolved !== undefined) {
    // `seg.abbr` is the CSS property name when `add()` names a property directly, or when a param
    // method keeps its default base name, i.e. `Css.letterSpacing(...)`; abbreviate those the same
    // way the multi-property branch does. Names the table does not list keep their spelling: both
    // the abbreviations that are already short, i.e. `mt`, and properties with no entry, i.e.
    // `scrollbarGutter`.
    return `${getPropertyAbbreviation(seg.abbr)}_${classNameFragmentForResolvedValue(seg.argResolved)}`;
  }
  return seg.abbr;
}

// ── Class-name building blocks ────────────────────────────────────────

/**
 * Build the condition prefix for a segment's class names.
 *
 * I.e. `ifSm.onHover.bgBlack` → `"sm_h_"` so the final class reads `sm_h_bgBlack`
 * ("on sm + hover, bgBlack"), and `when(row, "ancestor", ":hover").blue` → `"wh_anc_h_row_"`.
 */
function segmentClassPrefix(condition: ResolvedConditionContext, mapping: TrussMapping): string {
  const parts: string[] = [];
  if (condition.pseudoElement) {
    // I.e. "::placeholder" → "placeholder_"
    parts.push(`${condition.pseudoElement.replace(/^::/, "")}_`);
  }
  if (condition.mediaQuery) {
    // I.e. the `ifSm` breakpoint → "sm_"; any other media/container query is sanitized in full, i.e.
    // "@media (min-width: 600px)" → "media_min_width_600px_", so two different queries never share a class
    const breakpoint = breakpointNameForMediaQuery(mapping, condition.mediaQuery);
    parts.push(`${breakpoint ? breakpoint.toLowerCase() : sanitizeClassNameToken(condition.mediaQuery)}_`);
  }
  if (condition.pseudoClass) {
    parts.push(`${pseudoSelectorPrefix(condition.pseudoClass)}_`);
  }
  if (condition.whenPseudo) {
    parts.push(whenPrefix(condition.whenPseudo));
  }
  return parts.join("");
}

/** I.e. `when(marker, "ancestor", ":hover")` → `"wh_anc_h_"`, `when(row, …)` → `"wh_anc_h_row_"`. */
function whenPrefix(whenPseudo: WhenCondition): string {
  const rel = WHEN_RELATIONSHIPS[whenPseudo.relationship].short;
  const pseudoPrefix = pseudoSelectorPrefix(whenPseudo.pseudo);
  const markerPart = whenPseudo.markerNode ? `${whenPseudo.markerNode.name}_` : "";
  return `wh_${rel}_${pseudoPrefix}_${markerPart}`;
}

/** I.e. `"backgroundColor"` → `"background-color"`, `"WebkitTransform"` → `"-webkit-transform"`. */
export function camelToKebab(s: string): string {
  return s.replace(/^(Webkit|Moz|Ms|O)/, (m) => `-${m.toLowerCase()}`).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Collapse anything that is not a letter or digit into single underscores, i.e. `"0 0 0 1px blue"` → `"0_0_0_1px_blue"`. */
export function sanitizeClassNameToken(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** I.e. `"-8px"` → `"neg8px"`, `"0 0 0 1px blue"` → `"0_0_0_1px_blue"`. */
function cleanValueForClassName(value: string): string {
  return sanitizeClassNameToken(value.startsWith("-") ? `neg${value.slice(1)}` : value);
}

/** Class-name fragment for a resolved CSS value, i.e. `calc(var(--t-spacing) * 2)` → `"2"`, `"red"` → `"red"`. */
function classNameFragmentForResolvedValue(value: string): string {
  return cleanValueForClassName(tryParseIncrementCalcMultiplier(value) ?? value);
}

/** I.e. `"backgroundColor"` → `"bg"` (from the abbreviation table), or the raw name as fallback. */
function getPropertyAbbreviation(cssProp: string): string {
  return cssPropertyAbbreviations[cssProp] ?? cssProp;
}
