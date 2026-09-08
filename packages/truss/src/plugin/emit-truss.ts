import * as t from "@babel/types";
import { chainSegments, type ResolvedChain } from "./resolve-chain";
import {
  isCssSegment,
  type CssSegment,
  type ResolvedConditionContext,
  type ResolvedSegment,
  type TrussMapping,
  type VariableSegment,
  type WhenCondition,
} from "./types";
import { breakpointNameForMediaQuery, findCanonicalAbbreviation } from "./mapping-utils";
import { sortRulesByPriority } from "./priority";
import { cssPropertyAbbreviations } from "./css-property-abbreviations";
import { WHEN_RELATIONSHIPS, type WhenRelationship } from "./when-relationships";
import { pseudoSelectorPrefix } from "../pseudo-selectors";
import { variableValueNeedsMaybeCssVar } from "../css-custom-property";
import { SPACING_CUSTOM_PROPERTY, tryParseIncrementCalcMultiplier } from "../spacing-css-var";

// ── Atomic CSS rule model ─────────────────────────────────────────────

/**
 * A single atomic CSS rule: one class, one selector, one or more declarations.
 *
 * I.e. `.black { color: #353535; }` is one AtomicRule with a single declaration,
 * while `sq(x)` produces one AtomicRule with two declarations (`height` + `width`).
 */
export interface AtomicRule {
  /** I.e. `"sm_h_blue"` — the generated class name including condition prefixes. */
  className: string;
  /**
   * The CSS property/value pairs this rule sets. Always has at least one entry.
   *
   * I.e. `[{ cssProperty: "color", cssValue: "#526675" }]` for a static rule, or
   * `[{ cssProperty: "height", cssValue: "var(--height)", cssVarName: "--height" },
   *   { cssProperty: "width", cssValue: "var(--width)", cssVarName: "--width" }]` for `sq(x)`.
   */
  declarations: AtomicDeclaration[];
  pseudoClass?: string;
  mediaQuery?: string;
  pseudoElement?: string;
  /** I.e. `when(row, "ancestor", ":hover")` → `{ relationship: "ancestor", markerClass: "_row_mrk", pseudo: ":hover" }`. */
  whenSelector?: WhenSelector;
}

export interface AtomicDeclaration {
  cssProperty: string;
  cssValue: string;
  /** I.e. `"--marginTop"` — present when this declaration uses a CSS custom property. */
  cssVarName?: string;
}

export interface WhenSelector {
  relationship: WhenRelationship;
  markerClass: string;
  pseudo: string;
}

/** One class/property pair derived from a segment; the shared model both CSS rules and style hashes consume. */
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

// ── Collecting atomic rules from resolved chains ──────────────────────

export interface CollectedRules {
  rules: Map<string, AtomicRule>;
  needsMaybeInc: boolean;
  needsMaybeCssVar: boolean;
}

/**
 * Collect all atomic CSS rules from resolved chains.
 *
 * I.e. walks every segment in every chain part and registers one AtomicRule
 * per CSS declaration, keyed by the prefixed class name.
 */
export function collectAtomicRules(chains: ResolvedChain[], mapping: TrussMapping): CollectedRules {
  const rules = new Map<string, AtomicRule>();
  let needsMaybeInc = false;
  let needsMaybeCssVar = false;

  function collectSegment(seg: ResolvedSegment): void {
    if (seg.kind === "typography") {
      for (const segments of Object.values(seg.segmentsByName)) {
        segments.forEach(collectSegment);
      }
      return;
    }
    if (!isCssSegment(seg)) return;
    if (seg.kind === "variable") {
      if (seg.incremented) needsMaybeInc = true;
      if (seg.argResolved === undefined && variableValueNeedsMaybeCssVar(seg)) needsMaybeCssVar = true;
    }
    collectSegmentRules(rules, seg, mapping);
  }

  for (const chain of chains) {
    chainSegments(chain).forEach(collectSegment);
  }

  return { rules, needsMaybeInc, needsMaybeCssVar };
}

/** Collect atomic CSS rules for one resolved style segment. */
function collectSegmentRules(rules: Map<string, AtomicRule>, seg: CssSegment, mapping: TrussMapping): void {
  const { condition } = seg;

  for (const entry of styleEntriesForSegment(seg, mapping)) {
    const declaration: AtomicDeclaration = {
      cssProperty: camelToKebab(entry.cssProp),
      cssValue: entry.cssValue,
      ...(entry.varName ? { cssVarName: entry.varName } : {}),
    };
    const existingRule = rules.get(entry.className);
    if (!existingRule) {
      rules.set(entry.className, {
        className: entry.className,
        declarations: [declaration],
        pseudoClass: condition.pseudoClass ?? undefined,
        mediaQuery: condition.mediaQuery ?? undefined,
        pseudoElement: condition.pseudoElement ?? undefined,
        whenSelector: condition.whenPseudo ? whenSelectorFor(condition.whenPseudo) : undefined,
      });
      continue;
    }

    // I.e. `sq(x)` registers `height` and then `width` on the one `sq_var` rule.
    const alreadyDeclared = existingRule.declarations.some(
      (existing) => existing.cssProperty === declaration.cssProperty,
    );
    if (!alreadyDeclared) {
      existingRule.declarations.push(declaration);
    }
  }
}

/** I.e. `when(row, "ancestor", ":hover")` → `{ relationship: "ancestor", markerClass: "_row_mrk", pseudo: ":hover" }`. */
function whenSelectorFor(whenPseudo: WhenCondition): WhenSelector {
  return {
    relationship: whenPseudo.relationship,
    markerClass: markerClassName(whenPseudo.markerNode),
    pseudo: whenPseudo.pseudo,
  };
}

// ── Style entries (shared by CSS rules and style hashes) ──────────────

/**
 * Build normalized class/property entries from a segment for CSS and AST emitters.
 *
 * I.e. convert one resolved segment into the shared model both CSS rules and style hashes consume.
 */
function styleEntriesForSegment(seg: CssSegment, mapping: TrussMapping): StyleEntry[] {
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
    return `${seg.abbr}_${classNameFragmentForResolvedValue(seg.argResolved)}`;
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
    // I.e. the `ifSm` breakpoint → "sm_"; any other media/container query → "mq_"
    const breakpoint = breakpointNameForMediaQuery(mapping, condition.mediaQuery);
    parts.push(breakpoint ? `${breakpoint.toLowerCase()}_` : "mq_");
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

// ── CSS text generation ───────────────────────────────────────────────

/**
 * Generate the full CSS text from collected rules, sorted by StyleX priority.
 *
 * I.e. produces output like:
 * ```
 * /* @truss p:3000 c:black *\/
 * .black { color: #353535; }
 * /* @truss p:3200 c:sm_blue *\/
 * @media screen and (max-width: 599px) { .sm_blue.sm_blue { color: #526675; } }
 * ```
 */
export function generateCssText(rules: Map<string, AtomicRule>): string {
  const sorted = sortRulesByPriority(rules.values());
  const lines: string[] = [];

  for (const { rule, priority } of sorted) {
    lines.push(`/* @truss p:${priority} c:${rule.className} */`);
    lines.push(formatRule(rule));
  }

  // I.e. `@property --marginTop { syntax: "*"; inherits: false; }` for variable rules
  for (const { rule } of sorted) {
    for (const declaration of rule.declarations) {
      if (declaration.cssVarName) {
        lines.push(`/* @truss @property */`);
        lines.push(`@property ${declaration.cssVarName} { syntax: "*"; inherits: false; }`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format a single rule into its CSS text.
 *
 * I.e. a base rule → `.black { color: #353535; }`,
 * a media rule → `@media (...) { .sm_blue.sm_blue { color: #526675; } }`,
 * a when rule → `._mrk:hover .wh_anc_h_blue { color: #526675; }`.
 *
 * Inside a media query the class is doubled (`.sm_blue.sm_blue`) so it outranks the base class.
 */
function formatRule(rule: AtomicRule): string {
  const duplicateClassName = !!rule.mediaQuery;
  const whenSelector = rule.whenSelector;
  const selector = whenSelector
    ? WHEN_RELATIONSHIPS[whenSelector.relationship].selector(
        `.${whenSelector.markerClass}${whenSelector.pseudo}`,
        (extraPseudoClass) => buildTargetSelector(rule, duplicateClassName, extraPseudoClass),
      )
    : buildTargetSelector(rule, duplicateClassName);

  const body = rule.declarations.map((d) => `${d.cssProperty}: ${d.cssValue};`).join(" ");
  const block = `${selector} { ${body} }`;
  return rule.mediaQuery ? `${rule.mediaQuery} { ${block} }` : block;
}

/**
 * Assemble the target element's CSS selector from all active condition slots.
 *
 * I.e. `buildTargetSelector(rule, true)` → `.sm_h_blue.sm_h_blue:hover`,
 * `buildTargetSelector(rule, false, ":has(._mrk:hover)")` → `.wh_anc_h_blue:has(._mrk:hover)`.
 */
function buildTargetSelector(rule: AtomicRule, duplicateClassName: boolean, extraPseudoClass = ""): string {
  const classSelector = duplicateClassName ? `.${rule.className}.${rule.className}` : `.${rule.className}`;
  return `${classSelector}${rule.pseudoClass ?? ""}${extraPseudoClass}${rule.pseudoElement ?? ""}`;
}

// ── AST generation for style hash objects ─────────────────────────────

/**
 * Build the style hash AST for a list of segments (from one `Css.*.$` expression).
 *
 * I.e. `[blue, h_white]` → `{ color: "blue h_white" }`, and `[mt(x)]` →
 * `{ marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] }`.
 */
export function buildStyleHashProperties(
  segments: ResolvedSegment[],
  mapping: TrussMapping,
  maybeIncHelperName?: string | null,
  maybeCssVarHelperName?: string | null,
): t.ObjectProperty[] {
  return styleHashProperties(collectStyleEntryGroups(segments, mapping), maybeIncHelperName, maybeCssVarHelperName);
}

/**
 * Group the style entries of `segments` by CSS property, in order of first appearance.
 *
 * Within a group, a new base-level entry replaces earlier base-level entries while conditional
 * entries accumulate. I.e. `Css.blue.black.$` → the later `black` replaces `blue` for `color`,
 * but `Css.blue.onHover.black.$` keeps both because `onHover.black` is conditional.
 *
 * `seed` supplies the starting entries for a property the first time it appears, i.e. the base
 * `color` entries that an `if(cond).onHover.black` branch must carry alongside its own `h_black`.
 */
export function collectStyleEntryGroups(
  segments: ResolvedSegment[],
  mapping: TrussMapping,
  seed?: ReadonlyMap<string, StyleEntry[]>,
): Map<string, StyleEntry[]> {
  const propGroups = new Map<string, StyleEntry[]>();

  for (const seg of segments) {
    if (!isCssSegment(seg)) continue;
    for (const entry of styleEntriesForSegment(seg, mapping)) {
      const entries = propGroups.get(entry.cssProp) ?? seed?.get(entry.cssProp) ?? [];
      const kept = entry.isConditional ? entries : entries.filter((existing) => existing.isConditional);
      propGroups.set(entry.cssProp, [...kept, entry]);
    }
  }

  return propGroups;
}

/**
 * Build style hash properties from grouped entries.
 *
 * Static groups become space-separated class bundles, i.e. `{ color: "blue h_white" }`.
 * Groups with a variable entry become tuples, i.e. `{ marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] }`.
 */
export function styleHashProperties(
  propGroups: ReadonlyMap<string, StyleEntry[]>,
  maybeIncHelperName?: string | null,
  maybeCssVarHelperName?: string | null,
): t.ObjectProperty[] {
  const properties: t.ObjectProperty[] = [];

  for (const [cssProp, entries] of propGroups) {
    const classNames = entries.map((e) => e.className).join(" ");
    const variableEntries = entries.filter((e) => e.isVariable);

    if (variableEntries.length === 0) {
      properties.push(t.objectProperty(toPropertyKey(cssProp), t.stringLiteral(classNames)));
      continue;
    }

    const varsProps = variableEntries.map((dyn) => {
      return t.objectProperty(
        t.stringLiteral(dyn.varName!),
        variableValueExpression(dyn, maybeIncHelperName, maybeCssVarHelperName),
      );
    });
    const tuple = t.arrayExpression([t.stringLiteral(classNames), t.objectExpression(varsProps)]);
    properties.push(t.objectProperty(toPropertyKey(cssProp), tuple));
  }

  return properties;
}

/**
 * The runtime value stored in a variable tuple's vars object.
 *
 * I.e. a folded `Tokens.gap` → `"var(--gap)"`; `mt(x)` → `maybeCssVar(__maybeInc(x))`; `mtPx(x)` → `` `${x}px` ``.
 */
function variableValueExpression(
  dyn: StyleEntry,
  maybeIncHelperName?: string | null,
  maybeCssVarHelperName?: string | null,
): t.Expression {
  if (dyn.argResolved !== undefined) {
    return t.stringLiteral(dyn.argResolved);
  }

  let valueExpr = dyn.argNode!;
  if (dyn.incremented) {
    // I.e. wrap with `__maybeInc(x)` for increment-based values
    valueExpr = t.callExpression(t.identifier(maybeIncHelperName ?? "__maybeInc"), [valueExpr]);
  } else if (dyn.appendPx) {
    // I.e. wrap with `` `${v}px` `` for Px delegate values
    valueExpr = t.templateLiteral(
      [t.templateElement({ raw: "", cooked: "" }, false), t.templateElement({ raw: "px", cooked: "px" }, true)],
      [valueExpr],
    );
  }
  if (maybeCssVarHelperName && variableValueNeedsMaybeCssVar(dyn)) {
    valueExpr = t.callExpression(t.identifier(maybeCssVarHelperName), [valueExpr]);
  }
  return valueExpr;
}

// ── Helper AST declarations ───────────────────────────────────────────

/**
 * Build the per-file increment helper declaration.
 *
 * I.e. `const __maybeInc = (inc) => typeof inc === "string" ? inc : \`calc(var(--t-spacing) * \${inc})\`;`
 */
export function buildMaybeIncDeclaration(helperName: string): t.VariableDeclaration {
  const incParam = t.identifier("inc");
  const calcPrefix = `calc(var(${SPACING_CUSTOM_PROPERTY}) * `;
  const body = t.blockStatement([
    t.returnStatement(
      t.conditionalExpression(
        t.binaryExpression("===", t.unaryExpression("typeof", incParam), t.stringLiteral("string")),
        incParam,
        t.templateLiteral(
          [
            t.templateElement({ raw: calcPrefix, cooked: calcPrefix }, false),
            t.templateElement({ raw: ")", cooked: ")" }, true),
          ],
          [incParam],
        ),
      ),
    ),
  ]);

  return t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(helperName), t.arrowFunctionExpression([incParam], body)),
  ]);
}

/**
 * Build a runtime lookup table declaration for typography.
 *
 * I.e. `const __typography = { f24: { fontSize: "f24", lineHeight: "lh32" }, ... };`
 */
export function buildRuntimeLookupDeclaration(
  lookupName: string,
  segmentsByName: Record<string, ResolvedSegment[]>,
  mapping: TrussMapping,
): t.VariableDeclaration {
  const properties = Object.entries(segmentsByName).map(([name, segs]) => {
    return t.objectProperty(t.identifier(name), t.objectExpression(buildStyleHashProperties(segs, mapping)));
  });
  return t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(lookupName), t.objectExpression(properties)),
  ]);
}

/** I.e. `"color"` → `t.identifier("color")`, `"box-shadow"` → `t.stringLiteral("box-shadow")`. */
function toPropertyKey(key: string): t.Identifier | t.StringLiteral {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? t.identifier(key) : t.stringLiteral(key);
}
