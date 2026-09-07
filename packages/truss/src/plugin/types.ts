import type * as t from "@babel/types";
import type { WhenRelationship } from "./when-relationships";

/** The shape of the Css.json mapping file consumed by the Vite plugin. */
export interface TrussMapping {
  increment: number;
  breakpoints?: Record<string, string>;
  typography?: string[];
  /** Token member name → CSS variable (from `config.tokens`), for `setVar` key resolution. */
  tokens?: Record<string, string>;
  abbreviations: Record<string, TrussMappingEntry>;
}

/** A `when()` relationship selector context that can stack with other condition axes. */
export interface WhenCondition {
  pseudo: string;
  /** The user's marker variable, i.e. `row` in `when(row, "ancestor", ":hover")`. Absent for the default marker. */
  markerNode?: t.Identifier;
  relationship: WhenRelationship;
}

/** The active modifier axes while resolving a Css chain. */
export interface ResolvedConditionContext {
  mediaQuery: string | null;
  pseudoClass: string | null;
  pseudoElement: string | null;
  whenPseudo: WhenCondition | null;
}

/**
 * A single abbreviation entry from `Css.json`.
 *
 * Each `kind` describes how the transformer should resolve that abbreviation.
 */
export type TrussMappingEntry =
  /** I.e. `{ "kind": "static", "defs": { "display": "flex" } }` for `Css.df.$`. */
  | { kind: "static"; defs: Record<string, unknown> }
  /** I.e. `{ "kind": "variable", "props": ["marginTop"], "incremented": true }` for `Css.mt(v).$`. */
  | { kind: "variable"; props: string[]; incremented: boolean; extraDefs?: Record<string, unknown> }
  /** I.e. `{ "kind": "delegate", "target": "mt" }` for `Css.mtPx(v).$`. */
  | { kind: "delegate"; target: string }
  /** I.e. `{ "kind": "alias", "chain": ["f14", "black"] }` for `Css.bodyText.$`. */
  | { kind: "alias"; chain: string[] };

/**
 * A resolved chain segment — one abbreviation resolved to its CSS effect.
 *
 * The `defs` field always contains flat CSS property/value pairs (e.g. `{ color: "#353535" }`).
 * Condition context (media query, pseudo-class, pseudo-element, relationship selector) is tracked
 * via separate fields, NOT nested into defs. Consumers use the condition fields for class name
 * prefixing and CSS rule generation.
 */
export interface ResolvedSegment {
  /** The abbreviation name, i.e. "df", "black", "mt", "ba". */
  abbr: string;
  /** Flat CSS property/value defs for this segment (no condition nesting). */
  defs: Record<string, unknown>;
  /** If inside a media query context (e.g. "@media screen and (max-width:599px)"). */
  mediaQuery?: string | null;
  /** If inside a pseudo-class context (e.g. ":hover", ":focus"). */
  pseudoClass?: string | null;
  /** If inside a pseudo-element context (e.g. "::placeholder", "::selection"). */
  pseudoElement?: string | null;
  /** If inside a `when()` relationship selector context, the relationship + pseudo selector info. */
  whenPseudo?: WhenCondition | null;
  /** For variable entries: the CSS prop names. */
  variableProps?: string[];
  /** For variable entries: whether the value uses maybeInc. */
  incremented?: boolean;
  /** For variable Px delegates: whether the runtime value must append `px`. */
  appendPx?: boolean;
  /** For variable entries: additional static defs applied alongside the variable value. */
  variableExtraDefs?: Record<string, unknown>;
  /** For variable entries: the AST node of the argument. */
  argNode?: t.Expression;
  /** For composed Css props inserted via `with(cssProp)`. */
  styleArrayArg?: t.Expression;
  /** True when the composed style arg is an object literal that should skip undefined values. */
  isAddCss?: boolean;
  /** For custom class names inserted via `className(...)`. */
  classNameArg?: t.Expression;
  /** For custom inline style objects inserted via `style(...)`. */
  styleArg?: t.Expression;
  /**
   * Compile-time resolved argument value.
   * For static folds: the CSS value baked into an atomic class (e.g. `"red"`).
   * For `_var` segments: the tuple value (e.g. `"var(--theme-accent)"`).
   */
  argResolved?: string;
  /** For runtime typography lookups: the lookup metadata and runtime key node. */
  typographyLookup?: {
    /** I.e. `"typography"` or `"typography__sm"` for `Css.typography(key).$` in a given condition context. */
    lookupKey: string;
    argNode: t.Expression;
    segmentsByName: Record<string, ResolvedSegment[]>;
  };
  /**
   * If set, this segment represents an unsupported pattern that could not be resolved.
   * The error message describes what went wrong. Valid segments in the same chain
   * are preserved; only this segment is skipped in the output.
   */
  error?: string;
}

/**
 * A marker segment — not a CSS style, but a directive to attach
 * a default or user-defined marker class to the element.
 */
export interface MarkerSegment {
  type: "marker";
  /** If set, the AST node of the user-provided marker variable. Otherwise, default marker. */
  markerNode?: t.Expression;
}

/**
 * True for segments that resolve to atomic CSS declarations.
 *
 * I.e. `Css.df.$` and `Css.mt(x).$` are style segments; `className(...)`, `style(...)`,
 * `with(...)`, runtime `typography(key)`, and error placeholders are not.
 */
export function isStyleSegment(seg: ResolvedSegment): boolean {
  return !seg.error && !seg.styleArrayArg && !seg.classNameArg && !seg.styleArg && !seg.typographyLookup;
}

/** True when a segment or context sits under any modifier axis: media query, pseudo-class, pseudo-element, or `when()`. */
export function hasCondition(
  target: Pick<ResolvedSegment, "mediaQuery" | "pseudoClass" | "pseudoElement" | "whenPseudo">,
): boolean {
  return !!(target.mediaQuery || target.pseudoClass || target.pseudoElement || target.whenPseudo);
}
