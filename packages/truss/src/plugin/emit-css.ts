import { chainSegments, type ResolvedChain } from "./resolve-chain";
import { isCssSegment, type CssSegment, type ResolvedSegment, type TrussMapping, type WhenCondition } from "./types";
import { sortRulesByPriority } from "./priority";
import { markerClassName, styleEntriesForSegment } from "./style-entries";
import { camelToKebab } from "../utils";
import { WHEN_RELATIONSHIPS, type WhenRelationship } from "./when-relationships";
import { variableValueNeedsMaybeCssVar } from "../css-custom-property";
import type { ParsedTrussCss } from "../truss-css";
import { serializeTrussCss } from "./truss-css";

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
  return serializeTrussCss(generateCssData(rules));
}

/** Generate sorted atomic CSS data, retaining every emitted custom property declaration. */
export function generateCssData(rules: Map<string, AtomicRule>): ParsedTrussCss {
  const sorted = sortRulesByPriority(rules.values());
  const css: ParsedTrussCss = {
    rules: sorted.map((entry) => ({
      priority: entry.priority,
      className: entry.rule.className,
      cssText: formatRule(entry.rule),
    })),
    properties: [],
    arbitraryCssBlocks: [],
  };

  // I.e. `@property --marginTop { syntax: "*"; inherits: false; }` for variable rules
  for (const { rule } of sorted) {
    for (const declaration of rule.declarations) {
      if (declaration.cssVarName) {
        css.properties.push({
          varName: declaration.cssVarName,
          cssText: `@property ${declaration.cssVarName} { syntax: "*"; inherits: false; }`,
        });
      }
    }
  }

  return css;
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
