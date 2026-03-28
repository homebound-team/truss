import * as t from "@babel/types";
import type { ResolvedChain } from "./resolve-chain";
import type { ResolvedSegment, TrussMapping } from "./types";
import { computeRulePriority, sortRulesByPriority } from "./priority";
import { cssPropertyAbbreviations } from "./css-property-abbreviations";

// -- Atomic CSS rule model --

/** A single atomic CSS rule: one class, one selector, one or more declarations. */
export interface AtomicRule {
  className: string;
  cssProperty: string;
  cssValue: string;
  declarations?: Array<{
    cssProperty: string;
    cssValue: string;
    cssVarName?: string;
  }>;
  pseudoClass?: string;
  mediaQuery?: string;
  pseudoElement?: string;
  /** If true, this is a `var(--name)` rule that needs an `@property` declaration. */
  cssVarName?: string;
  /** For when() rules: the relationship selector context. */
  whenSelector?: {
    relationship: string;
    markerClass: string;
    pseudo: string;
  };
}

/** Pseudo-class short suffixes for class naming. */
const PSEUDO_SUFFIX: Record<string, string> = {
  ":hover": "_h",
  ":focus": "_f",
  ":focus-visible": "_fv",
  ":focus-within": "_fw",
  ":active": "_a",
  ":disabled": "_d",
  ":first-of-type": "_fot",
  ":last-of-type": "_lot",
};

/** Extra pseudo selector abbreviations used when() class names need static-but-safe tokens. */
const PSEUDO_SELECTOR_SUFFIX: Record<string, string> = {
  ...PSEUDO_SUFFIX,
  ":not": "_n",
  ":is": "_is",
  ":where": "_where",
  ":has": "_has",
};

/** Short abbreviations for relationship types in when() class names. */
const RELATIONSHIP_SHORT: Record<string, string> = {
  ancestor: "anc",
  descendant: "desc",
  siblingAfter: "sibA",
  siblingBefore: "sibB",
  anySibling: "anyS",
};

/** Default marker class name (used when no explicit marker is provided). */
export const DEFAULT_MARKER_CLASS = "_mrk";

/** Derive a marker class name from a marker AST node (or use the default). */
export function markerClassName(markerNode?: { type: string; name?: string }): string {
  if (!markerNode) return DEFAULT_MARKER_CLASS;
  if (markerNode.type === "Identifier" && markerNode.name) {
    return `_${markerNode.name}_mrk`;
  }
  return "_marker_mrk";
}

/**
 * Build a when() class name prefix from whenPseudo info.
 *
 * I.e. `when(marker, "ancestor", ":hover")` → `"wh_anc_h_"`,
 * `when(row, "ancestor", ":hover")` → `"wh_anc_h_row_"`.
 */
function whenPrefix(whenPseudo: { pseudo: string; markerNode?: any; relationship?: string }): string {
  const rel = RELATIONSHIP_SHORT[whenPseudo.relationship ?? "ancestor"] ?? "anc";
  const pseudoTag = pseudoSelectorTag(whenPseudo.pseudo);
  const markerPart = whenPseudo.markerNode?.type === "Identifier" ? `${whenPseudo.markerNode.name}_` : "";
  return `wh_${rel}_${pseudoTag}_${markerPart}`;
}

/** Convert a pseudo selector into a safe class-name token while preserving raw selector emission. */
function pseudoSelectorTag(pseudo: string): string {
  const replaced = pseudo.trim().replace(/::?[a-zA-Z-]+/g, (match) => {
    return `_${pseudoIdentifierTag(match)}_`;
  });
  const cleaned = replaced
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned || "pseudo";
}

function pseudoIdentifierTag(pseudo: string): string {
  const normalized = normalizePseudoIdentifier(pseudo);
  const known = PSEUDO_SELECTOR_SUFFIX[normalized];
  if (known) {
    return known.replace(/^_/, "");
  }
  return normalized.replace(/^::?/, "").replace(/-/g, "_");
}

function normalizePseudoIdentifier(pseudo: string): string {
  const prefixMatch = pseudo.match(/^::?/);
  const prefix = prefixMatch?.[0] ?? "";
  const name = pseudo.slice(prefix.length).replace(/[A-Z]/g, (match) => {
    return `-${match.toLowerCase()}`;
  });
  return `${prefix}${name}`;
}

/**
 * Build a condition prefix string for class naming.
 *
 * Conditions are prefixed so class names read naturally in the DOM:
 * I.e. `h_bgBlack` reads as "on hover, bgBlack".
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
    // Find breakpoint name, i.e. "ifSm" → "sm_"
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
    parts.push(`${pseudoSelectorTag(pseudoClass)}_`);
  }
  return parts.join("");
}

/** Convert camelCase CSS property to kebab-case (handles vendor prefixes like WebkitTransform). */
export function camelToKebab(s: string): string {
  return s.replace(/^(Webkit|Moz|Ms|O)/, (m) => `-${m.toLowerCase()}`).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Clean a CSS value for use in a class name. */
function cleanValueForClassName(value: string): string {
  // I.e. -8px → neg8px, 16px → 16px, "0 0 0 1px blue" → 0_0_0_1px_blue
  let cleaned = value;
  if (cleaned.startsWith("-")) {
    cleaned = "neg" + cleaned.slice(1);
  }
  return cleaned
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Build a reverse lookup from `"cssProperty\0cssValue"` → canonical abbreviation name.
 *
 * For each single-property static abbreviation in the mapping, records the
 * canonical name so multi-property abbreviations can reuse it.
 * I.e. `{ paddingTop: "8px" }` → `"pt1"`, `{ borderStyle: "solid" }` → `"bss"`.
 */
function buildLonghandLookup(mapping: TrussMapping): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [abbrev, entry] of Object.entries(mapping.abbreviations)) {
    if (entry.kind !== "static") continue;
    const props = Object.keys(entry.defs);
    if (props.length !== 1) continue;
    const prop = props[0];
    const value = String(entry.defs[prop]);
    const key = `${prop}\0${value}`;
    // First match wins — if multiple abbreviations produce the same declaration,
    // the one that appears first in the mapping is canonical.
    if (!lookup.has(key)) {
      lookup.set(key, abbrev);
    }
  }
  return lookup;
}

/** Cached longhand lookup per mapping (keyed by identity). */
let cachedMapping: TrussMapping | null = null;
let cachedLookup: Map<string, string> | null = null;

/** Get or build the longhand lookup for a mapping. */
function getLonghandLookup(mapping: TrussMapping): Map<string, string> {
  if (cachedMapping !== mapping) {
    cachedMapping = mapping;
    cachedLookup = buildLonghandLookup(mapping);
  }
  return cachedLookup!;
}

/** Get the short abbreviation for a CSS property, falling back to the raw name. */
function getPropertyAbbreviation(cssProp: string): string {
  return cssPropertyAbbreviations[cssProp] ?? cssProp;
}

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
      // Try to find a canonical single-property abbreviation for this longhand
      const lookup = getLonghandLookup(mapping);
      const canonical = lookup.get(`${cssProp}\0${cssValue}`);
      if (canonical) return canonical;
      // Use the actual CSS value (not argResolved) so fixed extra defs share classes
      // I.e. lineClamp("3") display:-webkit-box → `d_negwebkit_box`, not `d_3`
      return `${getPropertyAbbreviation(cssProp)}_${cleanValueForClassName(cssValue)}`;
    }
    return `${abbr}_${valuePart}`;
  }

  if (isMultiProp) {
    // Try to find a canonical single-property abbreviation for this longhand
    const lookup = getLonghandLookup(mapping);
    const canonical = lookup.get(`${cssProp}\0${cssValue}`);
    if (canonical) return canonical;
    return `${getPropertyAbbreviation(cssProp)}_${cleanValueForClassName(cssValue)}`;
  }

  return abbr;
}

// -- Collecting atomic rules from resolved chains --

export interface CollectedRules {
  rules: Map<string, AtomicRule>;
  needsMaybeInc: boolean;
}

/**
 * Collect all atomic CSS rules from resolved chains.
 *
 * Each segment maps directly to one or more atomic rules based on its
 * condition context (mediaQuery, pseudoClass, pseudoElement, whenPseudo).
 */
export function collectAtomicRules(chains: ResolvedChain[], mapping: TrussMapping): CollectedRules {
  const rules = new Map<string, AtomicRule>();
  let needsMaybeInc = false;

  function collectSegment(seg: ResolvedSegment): void {
    if (seg.error || seg.styleArrayArg || seg.classNameArg) return;
    if (seg.typographyLookup) {
      for (const segments of Object.values(seg.typographyLookup.segmentsByName)) {
        for (const nestedSeg of segments) {
          collectSegment(nestedSeg);
        }
      }
      return;
    }
    if (seg.incremented) needsMaybeInc = true;
    if (seg.variableProps) {
      collectVariableRules(rules, seg, mapping);
    } else {
      collectStaticRules(rules, seg, mapping);
    }
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

/** Compute the class name prefix and optional whenSelector for a segment. */
function segmentContext(
  seg: ResolvedSegment,
  mapping: TrussMapping,
): { prefix: string; whenSelector?: AtomicRule["whenSelector"] } {
  if (seg.whenPseudo) {
    const wp = seg.whenPseudo;
    return {
      prefix: whenPrefix(wp),
      whenSelector: {
        relationship: wp.relationship ?? "ancestor",
        markerClass: markerClassName(wp.markerNode),
        pseudo: wp.pseudo,
      },
    };
  }
  return { prefix: conditionPrefix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints) };
}

/** Build the base AtomicRule fields (non-when conditions). */
function baseRuleFields(seg: ResolvedSegment): Pick<AtomicRule, "pseudoClass" | "mediaQuery" | "pseudoElement"> {
  return {
    pseudoClass: seg.pseudoClass ?? undefined,
    mediaQuery: seg.mediaQuery ?? undefined,
    pseudoElement: seg.pseudoElement ?? undefined,
  };
}

/** Collect atomic rules for a static segment (may have multiple CSS properties). */
function collectStaticRules(rules: Map<string, AtomicRule>, seg: ResolvedSegment, mapping: TrussMapping): void {
  const { prefix, whenSelector } = segmentContext(seg, mapping);
  const isMultiProp = Object.keys(seg.defs).length > 1;

  for (const [cssProp, value] of Object.entries(seg.defs)) {
    const cssValue = String(value);
    const baseName = computeStaticBaseName(seg, cssProp, cssValue, isMultiProp, mapping);
    const className = prefix ? `${prefix}${baseName}` : baseName;

    if (!rules.has(className)) {
      rules.set(className, {
        className,
        cssProperty: camelToKebab(cssProp),
        cssValue,
        ...(!whenSelector && baseRuleFields(seg)),
        whenSelector,
      });
    }
  }
}

/** Collect atomic rules for a variable segment. */
function collectVariableRules(rules: Map<string, AtomicRule>, seg: ResolvedSegment, mapping: TrussMapping): void {
  const { prefix, whenSelector } = segmentContext(seg, mapping);

  for (const prop of seg.variableProps!) {
    const className = prefix ? `${prefix}${seg.abbr}_var` : `${seg.abbr}_var`;
    const varName = toCssVariableName(className, seg.abbr, prop);
    const declaration = { cssProperty: camelToKebab(prop), cssValue: `var(${varName})`, cssVarName: varName };

    const existingRule = rules.get(className);
    if (!existingRule) {
      rules.set(className, {
        className,
        cssProperty: declaration.cssProperty,
        cssValue: declaration.cssValue,
        declarations: [declaration],
        cssVarName: varName,
        ...(!whenSelector && baseRuleFields(seg)),
        whenSelector,
      });
      continue;
    }

    existingRule.declarations ??= [
      {
        cssProperty: existingRule.cssProperty,
        cssValue: existingRule.cssValue,
        cssVarName: existingRule.cssVarName,
      },
    ];
    if (
      !existingRule.declarations.some((entry) => {
        return entry.cssProperty === declaration.cssProperty;
      })
    ) {
      existingRule.declarations.push(declaration);
    }
  }

  // Extra static defs alongside variable props
  if (seg.variableExtraDefs) {
    for (const [cssProp, value] of Object.entries(seg.variableExtraDefs)) {
      const cssValue = String(value);
      const lookup = getLonghandLookup(mapping);
      const canonical = lookup.get(`${cssProp}\0${cssValue}`);
      const extraBase = canonical ?? `${getPropertyAbbreviation(cssProp)}_${cleanValueForClassName(cssValue)}`;
      const extraName = prefix ? `${prefix}${extraBase}` : extraBase;
      if (!rules.has(extraName)) {
        rules.set(extraName, {
          className: extraName,
          cssProperty: camelToKebab(cssProp),
          cssValue,
          ...(!whenSelector && baseRuleFields(seg)),
          whenSelector,
        });
      }
    }
  }
}

// -- CSS text generation --

/**
 * Generate the full CSS text from collected rules, sorted by StyleX priority.
 *
 * Uses an additive priority system where property tier + pseudo + at-rule priorities
 * are summed to produce a single sort key, guaranteeing longhands beat shorthands,
 * pseudo-classes follow LVFHA order, and at-rules override base styles.
 *
 * Each rule is preceded by a `/* @truss p:<priority> c:<className> *\/` annotation
 * that enables deterministic merging of CSS from independently-built libraries.
 */
export function generateCssText(rules: Map<string, AtomicRule>): string {
  const allRules = Array.from(rules.values());

  // Single flat sort by computed priority
  sortRulesByPriority(allRules);

  // Pre-compute priorities for annotations (mirrors sort order)
  const priorities = allRules.map(computeRulePriority);

  const lines: string[] = [];

  for (let i = 0; i < allRules.length; i++) {
    const rule = allRules[i];
    const priority = priorities[i];
    lines.push(`/* @truss p:${priority} c:${rule.className} */`);
    lines.push(formatRule(rule));
  }

  // @property declarations for variable rules
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

/** Format a single rule into its CSS text, dispatching by rule type. */
function formatRule(rule: AtomicRule): string {
  if (rule.whenSelector) return formatWhenRule(rule);
  if (rule.mediaQuery && rule.pseudoClass) return formatMediaPseudoRule(rule);
  if (rule.mediaQuery && rule.pseudoElement) return formatMediaPseudoElementRule(rule);
  if (rule.mediaQuery) return formatMediaRule(rule);
  if (rule.pseudoClass && rule.pseudoElement) return formatPseudoRule(rule);
  if (rule.pseudoElement) return formatPseudoElementRule(rule);
  if (rule.pseudoClass) return formatPseudoRule(rule);
  return formatBaseRule(rule);
}

function formatBaseRule(rule: AtomicRule): string {
  return formatRuleBlock(`.${rule.className}`, rule);
}

function formatPseudoRule(rule: AtomicRule): string {
  const pe = rule.pseudoElement ? rule.pseudoElement : "";
  return formatRuleBlock(`.${rule.className}${rule.pseudoClass}${pe}`, rule);
}

function formatPseudoElementRule(rule: AtomicRule): string {
  return formatRuleBlock(`.${rule.className}${rule.pseudoElement}`, rule);
}

function formatWhenRule(rule: AtomicRule): string {
  const whenSelector = rule.whenSelector;
  if (!whenSelector) {
    return formatBaseRule(rule);
  }

  const markerSelector = `.${whenSelector.markerClass}${whenSelector.pseudo}`;
  const targetSelector = `.${rule.className}`;

  if (whenSelector.relationship === "ancestor") {
    return formatRuleBlock(`${markerSelector} ${targetSelector}`, rule);
  }
  if (whenSelector.relationship === "descendant") {
    return formatRuleBlock(`${targetSelector}:has(${markerSelector})`, rule);
  }
  if (whenSelector.relationship === "siblingAfter") {
    return formatRuleBlock(`${targetSelector}:has(~ ${markerSelector})`, rule);
  }
  if (whenSelector.relationship === "siblingBefore") {
    return formatRuleBlock(`${markerSelector} ~ ${targetSelector}`, rule);
  }
  if (whenSelector.relationship === "anySibling") {
    return formatRuleBlock(`${targetSelector}:has(~ ${markerSelector}), ${markerSelector} ~ ${targetSelector}`, rule);
  }

  return formatRuleBlock(`${markerSelector} ${targetSelector}`, rule);
}

function formatMediaRule(rule: AtomicRule): string {
  return formatNestedRuleBlock(rule.mediaQuery!, `.${rule.className}.${rule.className}`, rule);
}

function formatMediaPseudoRule(rule: AtomicRule): string {
  return formatNestedRuleBlock(rule.mediaQuery!, `.${rule.className}.${rule.className}${rule.pseudoClass}`, rule);
}

function formatMediaPseudoElementRule(rule: AtomicRule): string {
  const pe = rule.pseudoElement ?? "";
  return formatNestedRuleBlock(rule.mediaQuery!, `.${rule.className}.${rule.className}${pe}`, rule);
}

function getRuleDeclarations(rule: AtomicRule): Array<{ cssProperty: string; cssValue: string; cssVarName?: string }> {
  return rule.declarations ?? [{ cssProperty: rule.cssProperty, cssValue: rule.cssValue, cssVarName: rule.cssVarName }];
}

function formatRuleBlock(selector: string, rule: AtomicRule): string {
  const body = getRuleDeclarations(rule)
    .map((declaration) => {
      return `${declaration.cssProperty}: ${declaration.cssValue};`;
    })
    .join(" ");
  return `${selector} { ${body} }`;
}

function formatNestedRuleBlock(wrapper: string, selector: string, rule: AtomicRule): string {
  const body = getRuleDeclarations(rule)
    .map((declaration) => {
      return `${declaration.cssProperty}: ${declaration.cssValue};`;
    })
    .join(" ");
  return `${wrapper} { ${selector} { ${body} } }`;
}

// -- AST generation for style hash objects --

/**
 * Build the style hash AST for a list of segments (from one Css.*.$  expression).
 *
 * Groups segments by CSS property and builds space-separated class bundles.
 * Returns an array of ObjectProperty nodes for `{ display: "df", color: "black blue_h" }`.
 */
export function buildStyleHashProperties(
  segments: ResolvedSegment[],
  mapping: TrussMapping,
  maybeIncHelperName?: string | null,
): t.ObjectProperty[] {
  // Group: cssProperty -> list of { className, isVariable, isConditional, varName, argNode, incremented, appendPx }
  const propGroups = new Map<
    string,
    Array<{
      className: string;
      isVariable: boolean;
      /** Whether this entry has a condition prefix (pseudo/media/when). */
      isConditional: boolean;
      varName?: string;
      argNode?: unknown;
      incremented?: boolean;
      appendPx?: boolean;
    }>
  >();

  /** Push an entry, replacing earlier base-level entries when a new base-level entry overrides the same property. */
  function pushEntry(cssProp: string, entry: typeof propGroups extends Map<string, Array<infer E>> ? E : never): void {
    if (!propGroups.has(cssProp)) propGroups.set(cssProp, []);
    const entries = propGroups.get(cssProp)!;
    // A later base-level entry replaces earlier base-level entries for the same property.
    // Conditional entries (hover/media) always accumulate alongside base entries.
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
    if (seg.error || seg.styleArrayArg || seg.typographyLookup || seg.classNameArg) continue;

    const { prefix } = segmentContext(seg, mapping);
    const isConditional = prefix !== "";

    if (seg.variableProps) {
      for (const prop of seg.variableProps) {
        const className = prefix ? `${prefix}${seg.abbr}_var` : `${seg.abbr}_var`;
        const varName = toCssVariableName(className, seg.abbr, prop);

        pushEntry(prop, {
          className,
          isVariable: true,
          isConditional,
          varName,
          argNode: seg.argNode,
          incremented: seg.incremented,
          appendPx: seg.appendPx,
        });
      }

      // Extra static defs
      if (seg.variableExtraDefs) {
        for (const [cssProp, value] of Object.entries(seg.variableExtraDefs)) {
          const cssValue = String(value);
          const lookup = getLonghandLookup(mapping);
          const canonical = lookup.get(`${cssProp}\0${cssValue}`);
          const extraBase = canonical ?? `${getPropertyAbbreviation(cssProp)}_${cleanValueForClassName(cssValue)}`;
          const extraName = prefix ? `${prefix}${extraBase}` : extraBase;
          pushEntry(cssProp, { className: extraName, isVariable: false, isConditional });
        }
      }
    } else {
      const isMultiProp = Object.keys(seg.defs).length > 1;

      for (const [cssProp, val] of Object.entries(seg.defs)) {
        const baseName = computeStaticBaseName(seg, cssProp, String(val), isMultiProp, mapping);
        const className = prefix ? `${prefix}${baseName}` : baseName;

        pushEntry(cssProp, { className, isVariable: false, isConditional });
      }
    }
  }

  // Build AST properties
  const properties: t.ObjectProperty[] = [];

  for (const [cssProp, entries] of Array.from(propGroups.entries())) {
    const classNames = entries.map((e) => e.className).join(" ");
    const variableEntries = entries.filter((e) => e.isVariable);

    if (variableEntries.length > 0) {
      // Tuple: [classNames, { vars }]
      const varsProps: t.ObjectProperty[] = [];
      for (const dyn of variableEntries) {
        let valueExpr: t.Expression = dyn.argNode as t.Expression;
        if (dyn.incremented) {
          // Wrap with __maybeInc (or whatever name was reserved to avoid collisions)
          valueExpr = t.callExpression(t.identifier(maybeIncHelperName ?? "__maybeInc"), [valueExpr]);
        } else if (dyn.appendPx) {
          // Wrap with `${v}px`
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
      // Static: plain string
      properties.push(t.objectProperty(toPropertyKey(cssProp), t.stringLiteral(classNames)));
    }
  }

  return properties;
}

/** Build a CSS variable name from the real CSS property and class condition prefix. */
function toCssVariableName(className: string, baseKey: string, cssProp: string): string {
  const baseClassName = `${baseKey}_var`;
  const cp = className.endsWith(baseClassName) ? className.slice(0, -baseClassName.length) : "";
  return `--${cp}${cssProp}`;
}

// -- Helper declarations --

/** Build the per-file increment helper: `const __maybeInc = (inc) => typeof inc === "string" ? inc : \`${inc * N}px\`` */
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

/** Use identifier keys when legal, otherwise string literal keys. */
function toPropertyKey(key: string): t.Identifier | t.StringLiteral {
  return isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key);
}

function isValidIdentifier(s: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

/** Build a runtime lookup table declaration: `const __typography = { f24: { fontSize: "f24" }, ... }`. */
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
