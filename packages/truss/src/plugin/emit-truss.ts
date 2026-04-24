import * as t from "@babel/types";
import type { ResolvedChain } from "./resolve-chain";
import { getLonghandLookup, type ResolvedSegment, type TrussMapping, type WhenCondition } from "./types";
import { computeRulePriority, sortRulesByPriority } from "./priority";
import { cssPropertyAbbreviations } from "./css-property-abbreviations";
import { pseudoSelectorPrefix } from "../pseudo-selectors";

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
  declarations: Array<{
    cssProperty: string;
    cssValue: string;
    /** I.e. `"--marginTop"` — present when this declaration uses a CSS custom property. */
    cssVarName?: string;
  }>;
  pseudoClass?: string;
  mediaQuery?: string;
  pseudoElement?: string;
  /** I.e. `when(row, "ancestor", ":hover")` → `{ relationship: "ancestor", markerClass: "_row_mrk", pseudo: ":hover" }`. */
  whenSelector?: {
    relationship: string;
    markerClass: string;
    pseudo: string;
  };
}

interface StyleEntry {
  cssProp: string;
  className: string;
  isVariable: boolean;
  /** Whether this entry has a condition prefix (pseudo/media/when). */
  isConditional: boolean;
  /** Concrete CSS declaration value for emitted CSS rules. */
  cssValue: string;
  varName?: string;
  argNode?: unknown;
  incremented?: boolean;
  appendPx?: boolean;
}

// ── Class-name constants and abbreviation maps ────────────────────────

/** I.e. `"ancestor"` → `"anc"`, `"siblingAfter"` → `"sibA"`. */
const RELATIONSHIP_SHORT: Record<string, string> = {
  ancestor: "anc",
  descendant: "desc",
  siblingAfter: "sibA",
  siblingBefore: "sibB",
  anySibling: "anyS",
};

// ── Marker class helpers ──────────────────────────────────────────────

/** I.e. the shared default marker class is `_mrk`. */
export const DEFAULT_MARKER_CLASS = "_mrk";

/** I.e. `markerClassName(row)` → `"_row_mrk"`, `markerClassName()` → `"_mrk"`. */
export function markerClassName(markerNode?: { type: string; name?: string }): string {
  if (!markerNode) return DEFAULT_MARKER_CLASS;
  if (markerNode.type === "Identifier" && markerNode.name) {
    return `_${markerNode.name}_mrk`;
  }
  return "_marker_mrk";
}

// ── Class-name prefix builders ────────────────────────────────────────

/** I.e. `when(marker, "ancestor", ":hover")` → `"wh_anc_h_"`, `when(row, …)` → `"wh_anc_h_row_"`. */
function whenPrefix(whenPseudo: WhenCondition): string {
  const rel = RELATIONSHIP_SHORT[whenPseudo.relationship ?? "ancestor"] ?? "anc";
  const pseudoPrefix = pseudoSelectorPrefix(whenPseudo.pseudo);
  const markerPart = whenPseudo.markerNode?.type === "Identifier" ? `${whenPseudo.markerNode.name}_` : "";
  return `wh_${rel}_${pseudoPrefix}_${markerPart}`;
}

/**
 * Build a condition prefix string for class naming.
 *
 * I.e. `conditionPrefix(":hover", smMedia, null, breakpoints)` → `"sm_h_"`,
 * so the final class reads `sm_h_bgBlack` ("on sm + hover, bgBlack").
 */
function conditionPrefix(
  pseudoClass: string | null | undefined,
  mediaQuery: string | null | undefined,
  pseudoElement: string | null | undefined,
  breakpoints?: Record<string, string>,
): string {
  const parts: string[] = [];
  if (pseudoElement) {
    // I.e. "::placeholder" → "placeholder_"
    parts.push(`${pseudoElement.replace(/^::/, "")}_`);
  }
  if (mediaQuery && breakpoints) {
    // I.e. find breakpoint name: "ifSm" → "sm_"
    const bpKey = Object.entries(breakpoints).find(([, v]) => v === mediaQuery)?.[0];
    if (bpKey) {
      const shortName = bpKey.replace(/^if/, "").toLowerCase();
      parts.push(`${shortName}_`);
    } else {
      parts.push("mq_");
    }
  } else if (mediaQuery) {
    parts.push("mq_");
  }
  if (pseudoClass) {
    parts.push(`${pseudoSelectorPrefix(pseudoClass)}_`);
  }
  return parts.join("");
}

// ── CSS property / value helpers ──────────────────────────────────────

/** I.e. `"backgroundColor"` → `"background-color"`, `"WebkitTransform"` → `"-webkit-transform"`. */
export function camelToKebab(s: string): string {
  return s.replace(/^(Webkit|Moz|Ms|O)/, (m) => `-${m.toLowerCase()}`).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** I.e. `"-8px"` → `"neg8px"`, `"0 0 0 1px blue"` → `"0_0_0_1px_blue"`. */
function cleanValueForClassName(value: string): string {
  let cleaned = value;
  if (cleaned.startsWith("-")) {
    cleaned = "neg" + cleaned.slice(1);
  }
  return cleaned
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** I.e. `"backgroundColor"` → `"bg"` (from the abbreviation table), or the raw name as fallback. */
function getPropertyAbbreviation(cssProp: string): string {
  return cssPropertyAbbreviations[cssProp] ?? cssProp;
}

// ── Longhand lookup (canonical abbreviation reuse) ────────────────────

// ── Static base class-name computation ────────────────────────────────

/**
 * Compute the base class name for a static segment.
 *
 * For multi-property abbreviations, looks up the canonical single-property
 * abbreviation name so classes are maximally reused.
 * I.e. `p1` → `pt1`, `pr1`, `pb1`, `pl1` (not `p1_paddingTop`, etc.)
 * I.e. `ba` → `bss`, `bw1` (not `ba_borderStyle`, etc.)
 *
 * For literal-folded variables (argResolved set), includes the value:
 * I.e. `mt(2)` → `mt_16px`, `bc("red")` → `bc_red`.
 */
function computeStaticBaseName(
  seg: ResolvedSegment,
  cssProp: string,
  cssValue: string,
  isMultiProp: boolean,
  mapping: TrussMapping,
): string {
  const abbr = seg.abbr;

  if (seg.argResolved !== undefined) {
    const valuePart = cleanValueForClassName(seg.argResolved);
    if (isMultiProp) {
      const lookup = getLonghandLookup(mapping);
      const canonical = lookup.get(`${cssProp}\0${cssValue}`);
      if (canonical) return canonical;
      // I.e. lineClamp("3") display:-webkit-box → `d_negwebkit_box`, not `d_3`
      return `${getPropertyAbbreviation(cssProp)}_${cleanValueForClassName(cssValue)}`;
    }
    return `${abbr}_${valuePart}`;
  }

  if (isMultiProp) {
    const lookup = getLonghandLookup(mapping);
    const canonical = lookup.get(`${cssProp}\0${cssValue}`);
    if (canonical) return canonical;
    return `${getPropertyAbbreviation(cssProp)}_${cleanValueForClassName(cssValue)}`;
  }

  return abbr;
}

// ── Collecting atomic rules from resolved chains ──────────────────────

export interface CollectedRules {
  rules: Map<string, AtomicRule>;
  needsMaybeInc: boolean;
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

  function collectSegment(seg: ResolvedSegment): void {
    if (seg.error || seg.styleArrayArg || seg.classNameArg || seg.styleArg) return;
    if (seg.typographyLookup) {
      for (const segments of Object.values(seg.typographyLookup.segmentsByName)) {
        for (const nestedSeg of segments) {
          collectSegment(nestedSeg);
        }
      }
      return;
    }
    if (seg.incremented) needsMaybeInc = true;
    collectSegmentRules(rules, seg, mapping);
  }

  for (const chain of chains) {
    for (const part of chain.parts) {
      const segs = part.type === "unconditional" ? part.segments : [...part.thenSegments, ...part.elseSegments];
      for (const seg of segs) {
        collectSegment(seg);
      }
    }
  }

  return { rules, needsMaybeInc };
}

/**
 * Compute the class name prefix and optional whenSelector for a segment.
 *
 * I.e. a segment with `pseudoClass: ":hover"` and `mediaQuery: smMedia` gets
 * prefix `"sm_h_"`, while one with `whenPseudo: { relationship: "ancestor", pseudo: ":hover" }`
 * also gets its `whenSelector` populated for CSS rule generation.
 */
function segmentContext(
  seg: ResolvedSegment,
  mapping: TrussMapping,
): { prefix: string; whenSelector?: AtomicRule["whenSelector"] } {
  const prefix = `${conditionPrefix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints)}${seg.whenPseudo ? whenPrefix(seg.whenPseudo) : ""}`;
  if (seg.whenPseudo) {
    const wp = seg.whenPseudo;
    return {
      prefix,
      whenSelector: {
        relationship: wp.relationship ?? "ancestor",
        markerClass: markerClassName(wp.markerNode),
        pseudo: wp.pseudo,
      },
    };
  }
  return { prefix };
}

/** I.e. extracts `pseudoClass`, `mediaQuery`, `pseudoElement` from a segment for AtomicRule fields. */
function baseRuleFields(seg: ResolvedSegment): Pick<AtomicRule, "pseudoClass" | "mediaQuery" | "pseudoElement"> {
  return {
    pseudoClass: seg.pseudoClass ?? undefined,
    mediaQuery: seg.mediaQuery ?? undefined,
    pseudoElement: seg.pseudoElement ?? undefined,
  };
}

/** Collect atomic CSS rules for one resolved style segment. */
function collectSegmentRules(rules: Map<string, AtomicRule>, seg: ResolvedSegment, mapping: TrussMapping): void {
  const { whenSelector } = segmentContext(seg, mapping);

  for (const entry of styleEntriesForSegment(seg, mapping)) {
    const declaration = {
      cssProperty: camelToKebab(entry.cssProp),
      cssValue: entry.cssValue,
      ...(entry.varName ? { cssVarName: entry.varName } : {}),
    };
    const existingRule = rules.get(entry.className);
    if (!existingRule) {
      rules.set(entry.className, {
        className: entry.className,
        declarations: [declaration],
        ...baseRuleFields(seg),
        whenSelector,
      });
      continue;
    }

    if (
      !existingRule.declarations.some((existingDeclaration) => {
        return existingDeclaration.cssProperty === declaration.cssProperty;
      })
    ) {
      existingRule.declarations.push(declaration);
    }
  }
}

/**
 * Build normalized class/property entries from a segment for CSS and AST emitters.
 *
 * I.e. convert one resolved segment into the shared model both CSS rules and style hashes consume.
 */
function styleEntriesForSegment(seg: ResolvedSegment, mapping: TrussMapping): StyleEntry[] {
  const { prefix } = segmentContext(seg, mapping);
  const isConditional = prefix !== "";

  if (seg.variableProps) {
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
  seg: ResolvedSegment,
  mapping: TrussMapping,
  prefix: string,
  isConditional: boolean,
  defs: Record<string, unknown>,
  forceLonghandNames = false,
): StyleEntry[] {
  const entries: StyleEntry[] = [];
  const isMultiProp = forceLonghandNames || Object.keys(defs).length > 1;

  for (const [cssProp, value] of Object.entries(defs)) {
    const cssValue = String(value);
    const baseName = computeStaticBaseName(seg, cssProp, cssValue, isMultiProp, mapping);
    entries.push({
      cssProp,
      className: prefix ? `${prefix}${baseName}` : baseName,
      isVariable: false,
      isConditional,
      cssValue,
    });
  }

  return entries;
}

/**
 * Build entries for runtime variable CSS defs.
 *
 * I.e. `Css.mt(x).$` becomes `marginTop -> mt_var` plus `--marginTop` metadata.
 */
function variableStyleEntries(
  seg: ResolvedSegment,
  mapping: TrussMapping,
  prefix: string,
  isConditional: boolean,
): StyleEntry[] {
  const entries: StyleEntry[] = [];

  for (const cssProp of seg.variableProps!) {
    const className = prefix ? `${prefix}${seg.abbr}_var` : `${seg.abbr}_var`;
    const varName = toCssVariableName(className, seg.abbr, cssProp);
    entries.push({
      cssProp,
      className,
      isVariable: true,
      isConditional,
      cssValue: `var(${varName})`,
      varName,
      argNode: seg.argNode,
      incremented: seg.incremented,
      appendPx: seg.appendPx,
    });
  }

  if (seg.variableExtraDefs) {
    entries.push(...staticStyleEntries(seg, mapping, prefix, isConditional, seg.variableExtraDefs, true));
  }

  return entries;
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
  const allRules = Array.from(rules.values());

  sortRulesByPriority(allRules);

  const priorities = allRules.map(computeRulePriority);
  const lines: string[] = [];

  for (let i = 0; i < allRules.length; i++) {
    const rule = allRules[i];
    const priority = priorities[i];
    lines.push(`/* @truss p:${priority} c:${rule.className} */`);
    lines.push(formatRule(rule));
  }

  // I.e. `@property --marginTop { syntax: "*"; inherits: false; }` for variable rules
  for (const rule of allRules) {
    for (const declaration of getRuleDeclarations(rule)) {
      if (declaration.cssVarName) {
        lines.push(`/* @truss @property */`);
        lines.push(`@property ${declaration.cssVarName} { syntax: "*"; inherits: false; }`);
      }
    }
  }

  return lines.join("\n");
}

// ── CSS rule formatting ───────────────────────────────────────────────

/**
 * Format a single rule into its CSS text, dispatching by rule kind.
 *
 * I.e. a base rule → `.black { color: #353535; }`,
 * a media rule → `@media (...) { .sm_blue.sm_blue { color: #526675; } }`,
 * a when rule → `._mrk:hover .wh_anc_h_blue { color: #526675; }`.
 */
function formatRule(rule: AtomicRule): string {
  const whenSelector = rule.whenSelector;
  if (whenSelector) return formatWhenRule(rule, whenSelector);
  const selector = buildTargetSelector(rule, !!rule.mediaQuery);
  return formatRuleWithOptionalMedia(rule, selector);
}

/**
 * Format a when()-relationship rule with the correct combinator per relationship kind.
 *
 * I.e. ancestor → `._mrk:hover .target { … }`,
 * descendant → `.target:has(._mrk:hover) { … }`,
 * anySibling → `.target:has(~ ._mrk:hover), ._mrk:hover ~ .target { … }`.
 */
function formatWhenRule(rule: AtomicRule, whenSelector: NonNullable<AtomicRule["whenSelector"]>): string {
  const markerSelector = `.${whenSelector.markerClass}${whenSelector.pseudo}`;
  const duplicateClassName = !!rule.mediaQuery;

  if (whenSelector.relationship === "ancestor") {
    return formatRuleWithOptionalMedia(rule, `${markerSelector} ${buildTargetSelector(rule, duplicateClassName)}`);
  }
  if (whenSelector.relationship === "descendant") {
    return formatRuleWithOptionalMedia(rule, buildTargetSelector(rule, duplicateClassName, `:has(${markerSelector})`));
  }
  if (whenSelector.relationship === "siblingAfter") {
    return formatRuleWithOptionalMedia(
      rule,
      buildTargetSelector(rule, duplicateClassName, `:has(~ ${markerSelector})`),
    );
  }
  if (whenSelector.relationship === "siblingBefore") {
    return formatRuleWithOptionalMedia(rule, `${markerSelector} ~ ${buildTargetSelector(rule, duplicateClassName)}`);
  }
  if (whenSelector.relationship === "anySibling") {
    const afterSelector = buildTargetSelector(rule, duplicateClassName, `:has(~ ${markerSelector})`);
    const beforeSelector = `${markerSelector} ~ ${buildTargetSelector(rule, duplicateClassName)}`;
    return formatRuleWithOptionalMedia(rule, `${afterSelector}, ${beforeSelector}`);
  }

  // I.e. unknown relationship falls back to ancestor-style descendant combinator
  return formatRuleWithOptionalMedia(rule, `${markerSelector} ${buildTargetSelector(rule, duplicateClassName)}`);
}

/**
 * Assemble the target element's CSS selector from all active condition slots.
 *
 * I.e. `buildTargetSelector(rule, true)` → `.sm_h_blue.sm_h_blue:hover`,
 * `buildTargetSelector(rule, false, ":has(._mrk:hover)")` → `.wh_anc_h_blue:has(._mrk:hover)`.
 */
function buildTargetSelector(rule: AtomicRule, duplicateClassName: boolean, extraPseudoClass?: string): string {
  const classSelector = duplicateClassName ? `.${rule.className}.${rule.className}` : `.${rule.className}`;
  const pseudoClass = rule.pseudoClass ?? "";
  const relationshipPseudoClass = extraPseudoClass ?? "";
  const pseudoElement = rule.pseudoElement ?? "";
  return `${classSelector}${pseudoClass}${relationshipPseudoClass}${pseudoElement}`;
}

/** I.e. wraps the selector in a media-query block when `rule.mediaQuery` is set. */
function formatRuleWithOptionalMedia(rule: AtomicRule, selector: string): string {
  if (rule.mediaQuery) {
    return formatNestedRuleBlock(rule.mediaQuery, selector, rule);
  }
  return formatRuleBlock(selector, rule);
}

/** I.e. returns the rule's declarations array (always has at least one entry). */
function getRuleDeclarations(rule: AtomicRule): Array<{ cssProperty: string; cssValue: string; cssVarName?: string }> {
  return rule.declarations;
}

/** I.e. `.black { color: #353535; }`. */
function formatRuleBlock(selector: string, rule: AtomicRule): string {
  const body = getRuleDeclarations(rule)
    .map((declaration) => {
      return `${declaration.cssProperty}: ${declaration.cssValue};`;
    })
    .join(" ");
  return `${selector} { ${body} }`;
}

/** I.e. `@media (...) { .sm_blue.sm_blue { color: #526675; } }`. */
function formatNestedRuleBlock(wrapper: string, selector: string, rule: AtomicRule): string {
  const body = getRuleDeclarations(rule)
    .map((declaration) => {
      return `${declaration.cssProperty}: ${declaration.cssValue};`;
    })
    .join(" ");
  return `${wrapper} { ${selector} { ${body} } }`;
}

// ── AST generation for style hash objects ─────────────────────────────

/**
 * Build the style hash AST for a list of segments (from one `Css.*.$` expression).
 *
 * Groups segments by CSS property and builds space-separated class bundles.
 * I.e. `[blue, h_white]` → `{ color: "blue h_white" }`.
 *
 * Variable entries produce tuples: `{ marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] }`.
 */
export function buildStyleHashProperties(
  segments: ResolvedSegment[],
  mapping: TrussMapping,
  maybeIncHelperName?: string | null,
): t.ObjectProperty[] {
  // I.e. cssProperty → list of { className, isVariable, isConditional, varName, argNode, ... }
  const propGroups = new Map<string, StyleEntry[]>();

  /**
   * Push an entry, replacing earlier base-level entries when a new base-level entry
   * overrides the same property.
   *
   * I.e. `Css.blue.black.$` → the later `black` replaces `blue` for `color`,
   * but `Css.blue.onHover.black.$` accumulates both because `onHover.black` is conditional.
   */
  function pushEntry(entry: StyleEntry): void {
    const cssProp = entry.cssProp;
    if (!propGroups.has(cssProp)) propGroups.set(cssProp, []);
    const entries = propGroups.get(cssProp)!;
    if (!entry.isConditional) {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (!entries[i].isConditional) {
          entries.splice(i, 1);
        }
      }
    }
    entries.push(entry);
  }

  for (const seg of segments) {
    if (seg.error || seg.styleArrayArg || seg.typographyLookup || seg.classNameArg || seg.styleArg) continue;

    for (const entry of styleEntriesForSegment(seg, mapping)) {
      pushEntry(entry);
    }
  }

  // Build AST ObjectProperty nodes
  const properties: t.ObjectProperty[] = [];

  for (const [cssProp, entries] of Array.from(propGroups.entries())) {
    const classNames = entries.map((e) => e.className).join(" ");
    const variableEntries = entries.filter((e) => e.isVariable);

    if (variableEntries.length > 0) {
      // I.e. `{ marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] }`
      const varsProps: t.ObjectProperty[] = [];
      for (const dyn of variableEntries) {
        let valueExpr: t.Expression = dyn.argNode as t.Expression;
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
        varsProps.push(t.objectProperty(t.stringLiteral(dyn.varName!), valueExpr));
      }

      const tuple = t.arrayExpression([t.stringLiteral(classNames), t.objectExpression(varsProps)]);
      properties.push(t.objectProperty(toPropertyKey(cssProp), tuple));
    } else {
      // I.e. static: `{ color: "blue h_white" }`
      properties.push(t.objectProperty(toPropertyKey(cssProp), t.stringLiteral(classNames)));
    }
  }

  return properties;
}

// ── CSS variable naming ───────────────────────────────────────────────

/** I.e. `toCssVariableName("sm_mt_var", "mt", "marginTop")` → `"--sm_marginTop"`. */
function toCssVariableName(className: string, baseKey: string, cssProp: string): string {
  const baseClassName = `${baseKey}_var`;
  const cp = className.endsWith(baseClassName) ? className.slice(0, -baseClassName.length) : "";
  return `--${cp}${cssProp}`;
}

// ── Helper AST declarations ───────────────────────────────────────────

/**
 * Build the per-file increment helper declaration.
 *
 * I.e. `const __maybeInc = (inc) => { return typeof inc === "string" ? inc : \`${inc * 8}px\`; };`
 */
export function buildMaybeIncDeclaration(helperName: string, increment: number): t.VariableDeclaration {
  const incParam = t.identifier("inc");
  const body = t.blockStatement([
    t.returnStatement(
      t.conditionalExpression(
        t.binaryExpression("===", t.unaryExpression("typeof", incParam), t.stringLiteral("string")),
        incParam,
        t.templateLiteral(
          [t.templateElement({ raw: "", cooked: "" }, false), t.templateElement({ raw: "px", cooked: "px" }, true)],
          [t.binaryExpression("*", incParam, t.numericLiteral(increment))],
        ),
      ),
    ),
  ]);

  return t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(helperName), t.arrowFunctionExpression([incParam], body)),
  ]);
}

/** I.e. `"color"` → `t.identifier("color")`, `"box-shadow"` → `t.stringLiteral("box-shadow")`. */
function toPropertyKey(key: string): t.Identifier | t.StringLiteral {
  return isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key);
}

/** I.e. `"color"` → true, `"box-shadow"` → false. */
function isValidIdentifier(s: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
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
  const properties: t.ObjectProperty[] = [];
  for (const [name, segs] of Object.entries(segmentsByName)) {
    const hashProps = buildStyleHashProperties(segs, mapping);
    properties.push(t.objectProperty(t.identifier(name), t.objectExpression(hashProps)));
  }
  return t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(lookupName), t.objectExpression(properties)),
  ]);
}
