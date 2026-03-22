import * as t from "@babel/types";
import type { ResolvedChain } from "./resolve-chain";
import type { ResolvedSegment, TrussMapping } from "./types";

// -- Atomic CSS rule model --

/** A single atomic CSS rule: one class, one selector, one declaration. */
export interface AtomicRule {
  className: string;
  cssProperty: string;
  cssValue: string;
  pseudoClass?: string;
  mediaQuery?: string;
  pseudoElement?: string;
  /** If true, this is a `var(--name)` rule that needs an `@property` declaration. */
  cssVarName?: string;
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

/** Build a condition suffix string for class naming. */
function conditionSuffix(
  pseudoClass: string | null | undefined,
  mediaQuery: string | null | undefined,
  pseudoElement: string | null | undefined,
  breakpoints?: Record<string, string>,
): string {
  const parts: string[] = [];
  if (pseudoElement) {
    // I.e. "::placeholder" → "_placeholder"
    parts.push(`_${pseudoElement.replace(/^::/, "")}`);
  }
  if (mediaQuery && breakpoints) {
    // Find breakpoint name, i.e. "ifSm" → "sm"
    const bpKey = Object.entries(breakpoints).find(([, v]) => v === mediaQuery)?.[0];
    if (bpKey) {
      const shortName = bpKey.replace(/^if/, "").toLowerCase();
      parts.push(`_${shortName}`);
    } else {
      parts.push("_mq");
    }
  } else if (mediaQuery) {
    parts.push("_mq");
  }
  if (pseudoClass) {
    const suffix = PSEUDO_SUFFIX[pseudoClass];
    if (suffix) parts.push(suffix);
    else parts.push(`_${pseudoClass.replace(/^:/, "")}`);
  }
  return parts.join("");
}

/** Convert camelCase CSS property to kebab-case. */
function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^(webkit|moz|ms)-/, "-$1-");
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
        if (seg.error || seg.styleArrayArg || seg.typographyLookup || seg.whenPseudo) continue;
        if (seg.dynamicProps) {
          if (seg.incremented) needsMaybeInc = true;
          collectDynamicRules(rules, seg, mapping);
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
  const suffix = conditionSuffix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints);
  const isMultiProp = Object.keys(rawDefs).length > 1;

  for (const [cssProp, value] of Object.entries(rawDefs)) {
    const cssValue = extractLeafValue(value);
    if (cssValue === null) continue;

    const baseName = isMultiProp ? `${seg.key.split("__")[0]}_${cssProp}` : seg.key.split("__")[0];
    const className = suffix ? `${baseName}${suffix}` : baseName;

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

/** Collect atomic rules for a dynamic segment. */
function collectDynamicRules(rules: Map<string, AtomicRule>, seg: ResolvedSegment, mapping: TrussMapping): void {
  const suffix = conditionSuffix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints);
  const baseKey = seg.key.split("__")[0];

  for (const prop of seg.dynamicProps!) {
    const dynSuffix = suffix ? `_dyn${suffix}` : "_dyn";
    const className = `${baseKey}${dynSuffix}`;
    const varName = `--${className}`;

    if (!rules.has(className)) {
      rules.set(className, {
        className,
        cssProperty: camelToKebab(prop),
        cssValue: `var(${varName})`,
        pseudoClass: seg.pseudoClass ?? undefined,
        mediaQuery: seg.mediaQuery ?? undefined,
        pseudoElement: seg.pseudoElement ?? undefined,
        cssVarName: varName,
      });
    }
  }

  // Extra static defs alongside dynamic props
  if (seg.dynamicExtraDefs) {
    for (const [cssProp, value] of Object.entries(seg.dynamicExtraDefs)) {
      const extraSuffix = suffix ? `${baseKey}_${cssProp}${suffix}` : `${baseKey}_${cssProp}`;
      if (!rules.has(extraSuffix)) {
        rules.set(extraSuffix, {
          className: extraSuffix,
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
  const media: AtomicRule[] = [];
  const mediaPseudo: AtomicRule[] = [];
  const mediaPseudoElement: AtomicRule[] = [];

  for (const rule of allRules) {
    if (rule.mediaQuery && rule.pseudoClass) {
      mediaPseudo.push(rule);
    } else if (rule.mediaQuery && rule.pseudoElement) {
      mediaPseudoElement.push(rule);
    } else if (rule.mediaQuery) {
      media.push(rule);
    } else if (rule.pseudoClass && rule.pseudoElement) {
      // pseudo-class + pseudo-element, emit in pseudo tier
      const order = PSEUDO_ORDER.indexOf(rule.pseudoClass);
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

  // Tier 4: media atoms (doubled selector)
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

  // @property declarations for dynamic rules
  for (const rule of allRules) {
    if (rule.cssVarName) {
      lines.push(`@property ${rule.cssVarName} {\n  syntax: "*";\n  inherits: false;\n}`);
    }
  }

  return lines.join("\n");
}

function formatBaseRule(rule: AtomicRule): string {
  return `.${rule.className} {\n  ${rule.cssProperty}: ${rule.cssValue};\n}`;
}

function formatPseudoRule(rule: AtomicRule): string {
  const pe = rule.pseudoElement ? rule.pseudoElement : "";
  return `.${rule.className}${rule.pseudoClass}${pe} {\n  ${rule.cssProperty}: ${rule.cssValue};\n}`;
}

function formatPseudoElementRule(rule: AtomicRule): string {
  return `.${rule.className}${rule.pseudoElement} {\n  ${rule.cssProperty}: ${rule.cssValue};\n}`;
}

function formatMediaRule(rule: AtomicRule): string {
  return `${rule.mediaQuery} {\n  .${rule.className}.${rule.className} {\n    ${rule.cssProperty}: ${rule.cssValue};\n  }\n}`;
}

function formatMediaPseudoRule(rule: AtomicRule): string {
  return `${rule.mediaQuery} {\n  .${rule.className}.${rule.className}${rule.pseudoClass} {\n    ${rule.cssProperty}: ${rule.cssValue};\n  }\n}`;
}

function formatMediaPseudoElementRule(rule: AtomicRule): string {
  const pe = rule.pseudoElement ?? "";
  return `${rule.mediaQuery} {\n  .${rule.className}.${rule.className}${pe} {\n    ${rule.cssProperty}: ${rule.cssValue};\n  }\n}`;
}

// -- AST generation for style hash objects --

/**
 * Build the style hash AST for a list of segments (from one Css.*.$  expression).
 *
 * Groups segments by CSS property and builds space-separated class bundles.
 * Returns an array of ObjectProperty nodes for `{ display: "df", color: "black blue_h" }`.
 */
export function buildStyleHashProperties(segments: ResolvedSegment[], mapping: TrussMapping): t.ObjectProperty[] {
  // Group: cssProperty → list of { className, isDynamic, varName, argNode, incremented, appendPx }
  const propGroups = new Map<
    string,
    Array<{
      className: string;
      isDynamic: boolean;
      varName?: string;
      argNode?: unknown;
      incremented?: boolean;
      appendPx?: boolean;
    }>
  >();

  for (const seg of segments) {
    if (seg.error || seg.styleArrayArg || seg.typographyLookup || seg.whenPseudo) continue;

    if (seg.dynamicProps) {
      const suffix = conditionSuffix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints);
      const baseKey = seg.key.split("__")[0];

      for (const prop of seg.dynamicProps) {
        const dynSuffix = suffix ? `_dyn${suffix}` : "_dyn";
        const className = `${baseKey}${dynSuffix}`;
        const varName = `--${className}`;

        if (!propGroups.has(prop)) propGroups.set(prop, []);
        propGroups.get(prop)!.push({
          className,
          isDynamic: true,
          varName,
          argNode: seg.argNode,
          incremented: seg.incremented,
          appendPx: seg.appendPx,
        });
      }

      // Extra static defs
      if (seg.dynamicExtraDefs) {
        for (const [cssProp, value] of Object.entries(seg.dynamicExtraDefs)) {
          const extraName = suffix ? `${baseKey}_${cssProp}${suffix}` : `${baseKey}_${cssProp}`;
          if (!propGroups.has(cssProp)) propGroups.set(cssProp, []);
          propGroups.get(cssProp)!.push({ className: extraName, isDynamic: false });
        }
      }
    } else {
      const rawDefs = unwrapDefs(seg.defs, seg.pseudoElement);
      const suffix = conditionSuffix(seg.pseudoClass, seg.mediaQuery, seg.pseudoElement, mapping.breakpoints);
      const isMultiProp = Object.keys(rawDefs).length > 1;

      for (const cssProp of Object.keys(rawDefs)) {
        const val = extractLeafValue(rawDefs[cssProp]);
        if (val === null) continue;

        const baseName = isMultiProp ? `${seg.key.split("__")[0]}_${cssProp}` : seg.key.split("__")[0];
        const className = suffix ? `${baseName}${suffix}` : baseName;

        if (!propGroups.has(cssProp)) propGroups.set(cssProp, []);
        propGroups.get(cssProp)!.push({ className, isDynamic: false });
      }
    }
  }

  // Build AST properties
  const properties: t.ObjectProperty[] = [];

  for (const [cssProp, entries] of Array.from(propGroups.entries())) {
    const classNames = entries.map((e) => e.className).join(" ");
    const dynamicEntries = entries.filter((e) => e.isDynamic);

    if (dynamicEntries.length > 0) {
      // Tuple: [classNames, { vars }]
      const varsProps: t.ObjectProperty[] = [];
      for (const dyn of dynamicEntries) {
        let valueExpr: t.Expression = dyn.argNode as t.Expression;
        if (dyn.incremented) {
          // Wrap with __maybeInc
          valueExpr = t.callExpression(t.identifier("__maybeInc"), [valueExpr]);
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

// -- Helpers carried forward from emit-stylex.ts --

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
