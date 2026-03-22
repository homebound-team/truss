import * as t from "@babel/types";
import type { ResolvedChain } from "./resolve-chain";
import type { ResolvedSegment, TrussMapping } from "./types";

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
  ":active": "_a",
  ":disabled": "_d",
};

/** Pseudo-class precedence order (weakest to strongest). */
const PSEUDO_ORDER: string[] = [":hover", ":focus", ":focus-visible", ":active", ":disabled"];

/** Short abbreviations for relationship types in when() class names. */
const RELATIONSHIP_SHORT: Record<string, string> = {
  ancestor: "anc",
  descendant: "desc",
  siblingAfter: "sibA",
  siblingBefore: "sibB",
  anySibling: "anyS",
};

/** Default marker class name (used when no explicit marker is provided). */
export const DEFAULT_MARKER_CLASS = "__truss_m";

/** Derive a marker class name from a marker AST node (or use the default). */
export function markerClassName(markerNode?: { type: string; name?: string }): string {
  if (!markerNode) return DEFAULT_MARKER_CLASS;
  if (markerNode.type === "Identifier" && markerNode.name) {
    return `__truss_m_${markerNode.name}`;
  }
  return `${DEFAULT_MARKER_CLASS}_marker`;
}

/**
 * Build a when() class name prefix from whenPseudo info.
 *
 * I.e. `when("ancestor", ":hover")` → `"wh_anc_h_"`,
 * `when("ancestor", row, ":hover")` → `"wh_anc_h_row_"`.
 */
function whenPrefix(whenPseudo: { pseudo: string; markerNode?: any; relationship?: string }): string {
  const rel = RELATIONSHIP_SHORT[whenPseudo.relationship ?? "ancestor"] ?? "anc";
  const pseudoTag = PSEUDO_SUFFIX[whenPseudo.pseudo]?.replace(/^_/, "") ?? whenPseudo.pseudo.replace(/^:/, "");
  const markerPart = whenPseudo.markerNode?.type === "Identifier" ? `${whenPseudo.markerNode.name}_` : "";
  return `wh_${rel}_${pseudoTag}_${markerPart}`;
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
    const tag = PSEUDO_SUFFIX[pseudoClass];
    // PSEUDO_SUFFIX values still have a leading underscore; strip it and add trailing
    if (tag) parts.push(`${tag.replace(/^_/, "")}_`);
    else parts.push(`${pseudoClass.replace(/^:/, "")}_`);
  }
  return parts.join("");
}

/** Convert camelCase CSS property to kebab-case. */
function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-");
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
  const abbrev = seg.key.split("__")[0];

  if (seg.argResolved !== undefined) {
    const valuePart = cleanValueForClassName(seg.argResolved);
    if (isMultiProp) {
      // Try to find a canonical single-property abbreviation for this longhand
      const lookup = getLonghandLookup(mapping);
      const canonical = lookup.get(`${cssProp}\0${cssValue}`);
      if (canonical) return canonical;
      return `${abbrev}_${valuePart}_${cssProp}`;
    }
    return `${abbrev}_${valuePart}`;
  }

  if (isMultiProp) {
    // Try to find a canonical single-property abbreviation for this longhand
    const lookup = getLonghandLookup(mapping);
    const canonical = lookup.get(`${cssProp}\0${cssValue}`);
    if (canonical) return canonical;
    return `${abbrev}_${cssProp}`;
  }

  return abbrev;
}

// -- Collecting atomic rules from resolved chains --

export interface CollectedRules {
  rules: Map<string, AtomicRule>;
  needsMaybeInc: boolean;
}

/**
 * Collect all atomic CSS rules from resolved chains.
 *
 * This processes segments BEFORE mergeOverlappingConditions — each segment
 * maps directly to one or more atomic rules based on its condition context.
 */
export function collectAtomicRules(chains: ResolvedChain[], mapping: TrussMapping): CollectedRules {
  const rules = new Map<string, AtomicRule>();
  let needsMaybeInc = false;

  for (const chain of chains) {
    for (const part of chain.parts) {
      const segs = part.type === "unconditional" ? part.segments : [...part.thenSegments, ...part.elseSegments];
      for (const seg of segs) {
        if (seg.error || seg.styleArrayArg || seg.typographyLookup) continue;
        if (seg.whenPseudo) {
          if (seg.variableProps) {
            if (seg.incremented) needsMaybeInc = true;
            collectWhenVariableRules(rules, seg, mapping);
          } else {
            collectWhenStaticRules(rules, seg, mapping);
          }
          continue;
        }
        if (seg.variableProps) {
          if (seg.incremented) needsMaybeInc = true;
          collectVariableRules(rules, seg, mapping);
        } else {
          collectStaticRules(rules, seg, mapping);
        }
      }
    }
  }

  return { rules, needsMaybeInc };
}

/** Collect atomic rules for a static segment (may have multiple CSS properties). */
function collectStaticRules(rules: Map<string, AtomicRule>, seg: ResolvedSegment, mapping: TrussMapping): void {
  // The segment's defs may be wrapped with StyleX-style condition nesting from
  // wrapDefsWithConditions. We use the segment's raw condition fields instead.
  const rawDefs = unwrapDefs(seg.defs, seg.pseudoElement);
  const prefix = conditionPrefix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints);
  const isMultiProp = Object.keys(rawDefs).length > 1;

  for (const [cssProp, value] of Object.entries(rawDefs)) {
    const cssValue = extractLeafValue(value);
    if (cssValue === null) continue;

    const baseName = computeStaticBaseName(seg, cssProp, String(cssValue), isMultiProp, mapping);
    const className = prefix ? `${prefix}${baseName}` : baseName;

    if (!rules.has(className)) {
      rules.set(className, {
        className,
        cssProperty: camelToKebab(cssProp),
        cssValue: String(cssValue),
        pseudoClass: seg.pseudoClass ?? undefined,
        mediaQuery: seg.mediaQuery ?? undefined,
        pseudoElement: seg.pseudoElement ?? undefined,
      });
    }
  }
}

/** Collect atomic rules for a variable segment. */
function collectVariableRules(rules: Map<string, AtomicRule>, seg: ResolvedSegment, mapping: TrussMapping): void {
  const prefix = conditionPrefix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints);
  const segmentBaseKey = seg.key.split("__")[0];

  for (const prop of seg.variableProps!) {
    const baseKey = seg.key.split("__")[0];
    const className = prefix ? `${prefix}${baseKey}_var` : `${baseKey}_var`;
    const varName = toCssVariableName(className, baseKey, prop);
    const declaration = { cssProperty: camelToKebab(prop), cssValue: `var(${varName})`, cssVarName: varName };

    const existingRule = rules.get(className);
    if (!existingRule) {
      rules.set(className, {
        className,
        cssProperty: declaration.cssProperty,
        cssValue: declaration.cssValue,
        declarations: [declaration],
        pseudoClass: seg.pseudoClass ?? undefined,
        mediaQuery: seg.mediaQuery ?? undefined,
        pseudoElement: seg.pseudoElement ?? undefined,
        cssVarName: varName,
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
      !existingRule.declarations.some(function (entry) {
        return entry.cssProperty === declaration.cssProperty;
      })
    ) {
      existingRule.declarations.push(declaration);
    }
  }

  // Extra static defs alongside variable props
  if (seg.variableExtraDefs) {
    for (const [cssProp, value] of Object.entries(seg.variableExtraDefs)) {
      const extraBase = `${segmentBaseKey}_${cssProp}`;
      const extraName = prefix ? `${prefix}${extraBase}` : extraBase;
      if (!rules.has(extraName)) {
        rules.set(extraName, {
          className: extraName,
          cssProperty: camelToKebab(cssProp),
          cssValue: String(value),
          pseudoClass: seg.pseudoClass ?? undefined,
          mediaQuery: seg.mediaQuery ?? undefined,
          pseudoElement: seg.pseudoElement ?? undefined,
        });
      }
    }
  }
}

/** Collect atomic rules for a static when() segment. */
function collectWhenStaticRules(rules: Map<string, AtomicRule>, seg: ResolvedSegment, mapping: TrussMapping): void {
  const wp = seg.whenPseudo!;
  const prefix = whenPrefix(wp);
  const rawDefs = seg.defs;
  const isMultiProp = Object.keys(rawDefs).length > 1;
  const mClass = markerClassName(wp.markerNode);

  for (const [cssProp, value] of Object.entries(rawDefs)) {
    const cssValue = typeof value === "string" || typeof value === "number" ? value : extractLeafValue(value);
    if (cssValue === null) continue;

    const baseName = computeStaticBaseName(seg, cssProp, String(cssValue), isMultiProp, mapping);
    const className = `${prefix}${baseName}`;

    if (!rules.has(className)) {
      rules.set(className, {
        className,
        cssProperty: camelToKebab(cssProp),
        cssValue: String(cssValue),
        whenSelector: {
          relationship: wp.relationship ?? "ancestor",
          markerClass: mClass,
          pseudo: wp.pseudo,
        },
      });
    }
  }
}

/** Collect atomic rules for a variable when() segment. */
function collectWhenVariableRules(rules: Map<string, AtomicRule>, seg: ResolvedSegment, mapping: TrussMapping): void {
  const wp = seg.whenPseudo!;
  const prefix = whenPrefix(wp);
  const segmentBaseKey = seg.key.split("__")[0];
  const mClass = markerClassName(wp.markerNode);

  for (const prop of seg.variableProps!) {
    const baseKey = seg.key.split("__")[0];
    const className = `${prefix}${baseKey}_var`;
    const varName = toCssVariableName(className, baseKey, prop);
    const declaration = { cssProperty: camelToKebab(prop), cssValue: `var(${varName})`, cssVarName: varName };

    const existingRule = rules.get(className);
    if (!existingRule) {
      rules.set(className, {
        className,
        cssProperty: declaration.cssProperty,
        cssValue: declaration.cssValue,
        declarations: [declaration],
        cssVarName: varName,
        whenSelector: {
          relationship: wp.relationship ?? "ancestor",
          markerClass: mClass,
          pseudo: wp.pseudo,
        },
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
      !existingRule.declarations.some(function (entry) {
        return entry.cssProperty === declaration.cssProperty;
      })
    ) {
      existingRule.declarations.push(declaration);
    }
  }

  if (seg.variableExtraDefs) {
    for (const [cssProp, value] of Object.entries(seg.variableExtraDefs)) {
      const extraName = `${prefix}${segmentBaseKey}_${cssProp}`;
      if (!rules.has(extraName)) {
        rules.set(extraName, {
          className: extraName,
          cssProperty: camelToKebab(cssProp),
          cssValue: String(value),
          whenSelector: {
            relationship: wp.relationship ?? "ancestor",
            markerClass: mClass,
            pseudo: wp.pseudo,
          },
        });
      }
    }
  }
}

/** Unwrap StyleX-style condition nesting and pseudo-element wrapping to get raw defs. */
function unwrapDefs(defs: Record<string, unknown>, pseudoElement?: string | null): Record<string, unknown> {
  let result = defs;
  // Unwrap pseudo-element wrapper: { "::placeholder": { color: ... } } → { color: ... }
  if (pseudoElement && result[pseudoElement] && typeof result[pseudoElement] === "object") {
    result = result[pseudoElement] as Record<string, unknown>;
  }
  // Unwrap condition nesting: { color: { default: null, ":hover": "blue" } } → { color: "blue" }
  // For segments with conditions, we want just the leaf value
  const unwrapped: Record<string, unknown> = {};
  for (const [prop, val] of Object.entries(result)) {
    unwrapped[prop] = extractLeafValue(val) ?? val;
  }
  return unwrapped;
}

/**
 * Extract the actual CSS value from a potentially nested condition object.
 * I.e. `{ default: null, ":hover": "blue" }` → `"blue"`,
 * or `{ default: null, ":hover": { default: null, "@media...": "blue" } }` → `"blue"`.
 */
function extractLeafValue(value: unknown): string | number | null {
  if (typeof value === "string" || typeof value === "number") return value;
  if (value === null) return null;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Find the non-default, non-null leaf
    for (const [k, v] of Object.entries(obj)) {
      if (k === "default") continue;
      if (typeof v === "string" || typeof v === "number") return v;
      if (typeof v === "object" && v !== null) return extractLeafValue(v);
    }
    // If only default, return it
    if ("default" in obj && obj.default !== null) {
      return extractLeafValue(obj.default);
    }
  }
  return null;
}

// -- CSS text generation --

/** Generate the full CSS text from collected rules, ordered by specificity tiers. */
export function generateCssText(rules: Map<string, AtomicRule>): string {
  const allRules = Array.from(rules.values());

  // Sort into tiers
  const base: AtomicRule[] = [];
  const pseudo: Map<string, AtomicRule[]> = new Map();
  const pseudoElement: AtomicRule[] = [];
  const whenRules: AtomicRule[] = [];
  const media: AtomicRule[] = [];
  const mediaPseudo: AtomicRule[] = [];
  const mediaPseudoElement: AtomicRule[] = [];

  for (const rule of allRules) {
    if (rule.whenSelector) {
      whenRules.push(rule);
    } else if (rule.mediaQuery && rule.pseudoClass) {
      mediaPseudo.push(rule);
    } else if (rule.mediaQuery && rule.pseudoElement) {
      mediaPseudoElement.push(rule);
    } else if (rule.mediaQuery) {
      media.push(rule);
    } else if (rule.pseudoClass && rule.pseudoElement) {
      // pseudo-class + pseudo-element, emit in pseudo tier
      const tier = pseudo.get(rule.pseudoClass) ?? [];
      tier.push(rule);
      pseudo.set(rule.pseudoClass, tier);
    } else if (rule.pseudoElement) {
      pseudoElement.push(rule);
    } else if (rule.pseudoClass) {
      const tier = pseudo.get(rule.pseudoClass) ?? [];
      tier.push(rule);
      pseudo.set(rule.pseudoClass, tier);
    } else {
      base.push(rule);
    }
  }

  sortRulesWithinPropertyTier(base);
  sortRulesWithinPropertyTier(pseudoElement);
  sortRulesWithinPropertyTier(whenRules);
  sortRulesWithinPropertyTier(media);
  sortRulesWithinPropertyTier(mediaPseudo);
  sortRulesWithinPropertyTier(mediaPseudoElement);
  for (const tier of pseudo.values()) {
    sortRulesWithinPropertyTier(tier);
  }

  const lines: string[] = [];

  // Tier 1: base atoms
  for (const rule of base) {
    lines.push(formatBaseRule(rule));
  }

  // Tier 2: pseudo-class atoms, ordered by precedence
  for (const pc of PSEUDO_ORDER) {
    const tier = pseudo.get(pc);
    if (!tier) continue;
    for (const rule of tier) {
      lines.push(formatPseudoRule(rule));
    }
  }
  // Any pseudo-classes not in the table (shouldn't happen, but be safe)
  for (const [pc, tier] of Array.from(pseudo.entries())) {
    if (PSEUDO_ORDER.includes(pc)) continue;
    for (const rule of tier) {
      lines.push(formatPseudoRule(rule));
    }
  }

  // Tier 3: pseudo-element atoms
  for (const rule of pseudoElement) {
    lines.push(formatPseudoElementRule(rule));
  }

  // Tier 4: when() relationship selector atoms
  for (const rule of whenRules) {
    lines.push(formatWhenRule(rule));
  }

  // Tier 5: media atoms (doubled selector)
  for (const rule of media) {
    lines.push(formatMediaRule(rule));
  }

  // Tier 5: media+pseudo atoms (doubled selector + pseudo)
  for (const rule of mediaPseudo) {
    lines.push(formatMediaPseudoRule(rule));
  }

  // Tier 6: media+pseudo-element atoms
  for (const rule of mediaPseudoElement) {
    lines.push(formatMediaPseudoElementRule(rule));
  }

  // @property declarations for variable rules
  for (const rule of allRules) {
    for (const declaration of getRuleDeclarations(rule)) {
      if (declaration.cssVarName) {
        lines.push(`@property ${declaration.cssVarName} {\n  syntax: "*";\n  inherits: false;\n}`);
      }
    }
  }

  return lines.join("\n");
}

function sortRulesWithinPropertyTier(rules: AtomicRule[]): void {
  const indexedRules = rules.map(function (rule, index) {
    return { rule, index };
  });

  indexedRules.sort(function (left, right) {
    if (left.rule.cssProperty !== right.rule.cssProperty) {
      return left.index - right.index;
    }

    const leftIsVariable = isVariableRule(left.rule);
    const rightIsVariable = isVariableRule(right.rule);
    if (leftIsVariable !== rightIsVariable) {
      return leftIsVariable ? 1 : -1;
    }

    return left.index - right.index;
  });

  for (let i = 0; i < indexedRules.length; i++) {
    rules[i] = indexedRules[i].rule;
  }
}

function isVariableRule(rule: AtomicRule): boolean {
  return getRuleDeclarations(rule).some(function (declaration) {
    return declaration.cssVarName !== undefined;
  });
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
    .map(function (declaration) {
      return `  ${declaration.cssProperty}: ${declaration.cssValue};`;
    })
    .join("\n");
  return `${selector} {\n${body}\n}`;
}

function formatNestedRuleBlock(wrapper: string, selector: string, rule: AtomicRule): string {
  const body = getRuleDeclarations(rule)
    .map(function (declaration) {
      return `    ${declaration.cssProperty}: ${declaration.cssValue};`;
    })
    .join("\n");
  return `${wrapper} {\n  ${selector} {\n${body}\n  }\n}`;
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
  // Group: cssProperty -> list of { className, isVariable, varName, argNode, incremented, appendPx }
  const propGroups = new Map<
    string,
    Array<{
      className: string;
      isVariable: boolean;
      varName?: string;
      argNode?: unknown;
      incremented?: boolean;
      appendPx?: boolean;
    }>
  >();

  for (const seg of segments) {
    if (seg.error || seg.styleArrayArg || seg.typographyLookup) continue;

    if (seg.variableProps) {
      const prefix = seg.whenPseudo
        ? whenPrefix(seg.whenPseudo)
        : conditionPrefix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints);
      const segmentBaseKey = seg.key.split("__")[0];

      for (const prop of seg.variableProps) {
        const baseKey = seg.key.split("__")[0];
        const className = prefix ? `${prefix}${baseKey}_var` : `${baseKey}_var`;
        const varName = toCssVariableName(className, baseKey, prop);

        if (!propGroups.has(prop)) propGroups.set(prop, []);
        propGroups.get(prop)!.push({
          className,
          isVariable: true,
          varName,
          argNode: seg.argNode,
          incremented: seg.incremented,
          appendPx: seg.appendPx,
        });
      }

      // Extra static defs
      if (seg.variableExtraDefs) {
        for (const [cssProp, value] of Object.entries(seg.variableExtraDefs)) {
          const extraBase = `${segmentBaseKey}_${cssProp}`;
          const extraName = prefix ? `${prefix}${extraBase}` : extraBase;
          if (!propGroups.has(cssProp)) propGroups.set(cssProp, []);
          propGroups.get(cssProp)!.push({ className: extraName, isVariable: false });
        }
      }
    } else {
      const rawDefs = seg.whenPseudo ? seg.defs : unwrapDefs(seg.defs, seg.pseudoElement);
      const prefix = seg.whenPseudo
        ? whenPrefix(seg.whenPseudo)
        : conditionPrefix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints);
      const isMultiProp = Object.keys(rawDefs).length > 1;

      for (const cssProp of Object.keys(rawDefs)) {
        const val = extractLeafValue(rawDefs[cssProp]);
        if (val === null) continue;

        const baseName = computeStaticBaseName(seg, cssProp, String(val), isMultiProp, mapping);
        const className = prefix ? `${prefix}${baseName}` : baseName;

        if (!propGroups.has(cssProp)) propGroups.set(cssProp, []);
        propGroups.get(cssProp)!.push({ className, isVariable: false });
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
  const conditionPrefix = className.endsWith(baseClassName) ? className.slice(0, -baseClassName.length) : "";
  return `--${conditionPrefix}${cssProp}`;
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
