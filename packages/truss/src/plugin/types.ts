import type * as t from "@babel/types";
import type { WhenRelationship } from "./when-relationships";

/** A transform error with optional source metadata for build-tool reporting. */
export interface TransformDiagnostic extends Error {
  id?: string;
  loc?: { file: string; line: number; column: number };
}

/** Report transform diagnostics; the build tool decides whether they are fatal. */
export interface DiagnosticOptions {
  onDiagnostic?: (diagnostic: TransformDiagnostic) => void;
}

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

/** Fields shared by the segments that resolve to atomic CSS declarations. */
interface CssSegmentBase {
  /** The abbreviation name, i.e. "df", "black", "mt", "ba"; the base of the generated class name. */
  abbr: string;
  /** The modifier axes this segment resolved under, snapshotted at resolution time. */
  condition: ResolvedConditionContext;
}

/**
 * Concrete CSS property/value pairs.
 *
 * I.e. `Css.df.$` → `defs: { display: "flex" }`. A folded `Css.mt(2).$` also carries
 * `argResolved: "calc(var(--t-spacing) * 2)"` so its class name can include the value.
 */
export interface StaticSegment extends CssSegmentBase {
  kind: "static";
  defs: Record<string, unknown>;
  argResolved?: string;
}

/**
 * A `_var` class whose value comes from a CSS custom property.
 *
 * I.e. `Css.mt(x).$` sets `argNode` (the runtime value), while `Css.mt(Tokens.gap).$` sets
 * `argResolved: "var(--gap)"` so every token shares the one `mt_var` class.
 */
export interface VariableSegment extends CssSegmentBase {
  kind: "variable";
  /** The CSS props the variable sets, i.e. `["height", "width"]` for `sq(x)`. */
  props: string[];
  /** Whether the runtime value goes through `__maybeInc`. */
  incremented: boolean;
  /** For Px delegates: whether the runtime value must append `px`. */
  appendPx: boolean;
  /** Additional static defs applied alongside the variable value. */
  extraDefs?: Record<string, unknown>;
  argNode?: t.Expression;
  argResolved?: string;
}

/** A raw class name appended at runtime, i.e. `Css.className(cls).$`. */
export interface ClassNameSegment {
  kind: "className";
  arg: t.Expression;
}

/** A raw inline style object merged at runtime, i.e. `Css.style(vars).$`. */
export interface InlineStyleSegment {
  kind: "inlineStyle";
  arg: t.Expression;
}

/** An existing Css expression composed into the chain via `with(cssProp)`. */
export interface ComposedSegment {
  kind: "composed";
  arg: t.Expression;
  /** True for `with({ height })` object literals, whose undefined values are skipped at runtime. */
  skipUndefined: boolean;
}

/** A runtime `typography(key)` lookup: every typography abbreviation pre-resolved under the current condition. */
export interface TypographyLookupSegment {
  kind: "typography";
  /** I.e. `"typography"` or `"typography__sm"` for `Css.typography(key).$` in a given condition context. */
  lookupKey: string;
  argNode: t.Expression;
  segmentsByName: Record<string, ResolvedSegment[]>;
}

/**
 * An unsupported pattern that could not be resolved.
 *
 * Valid segments in the same chain are preserved; only this segment is skipped in the output.
 */
export interface ErrorSegment {
  kind: "error";
  message: string;
}

/** The segments that resolve to atomic CSS declarations. */
export type CssSegment = StaticSegment | VariableSegment;

/** A resolved chain segment — one abbreviation resolved to its effect on the element. */
export type ResolvedSegment =
  CssSegment | ClassNameSegment | InlineStyleSegment | ComposedSegment | TypographyLookupSegment | ErrorSegment;

/**
 * A marker segment — not a CSS style, but a directive to attach
 * a default or user-defined marker class to the element.
 */
export interface MarkerSegment {
  type: "marker";
  /** If set, the AST node of the user-provided marker variable. Otherwise, default marker. */
  markerNode?: t.Expression;
}

/** True for segments that resolve to atomic CSS declarations. */
export function isCssSegment(seg: ResolvedSegment): seg is CssSegment {
  return seg.kind === "static" || seg.kind === "variable";
}

/** True when any modifier axis is active: media query, pseudo-class, pseudo-element, or `when()`. */
export function hasCondition(condition: ResolvedConditionContext): boolean {
  return !!(condition.mediaQuery || condition.pseudoClass || condition.pseudoElement || condition.whenPseudo);
}
