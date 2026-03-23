/** The shape of the Css.json mapping file consumed by the Vite plugin. */
export interface TrussMapping {
  increment: number;
  breakpoints?: Record<string, string>;
  typography?: string[];
  abbreviations: Record<string, TrussMappingEntry>;
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
 * Condition context (media query, pseudo-class, pseudo-element) is tracked via separate fields,
 * NOT nested into defs. Consumers use the condition fields for class name prefixing and CSS rule
 * generation.
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
  whenPseudo?: { pseudo: string; markerNode?: any; relationship?: string };
  /** For variable entries: the CSS prop names. */
  variableProps?: string[];
  /** For variable entries: whether the value uses maybeInc. */
  incremented?: boolean;
  /** For variable Px delegates: whether the runtime value must append `px`. */
  appendPx?: boolean;
  /** For variable entries: additional static defs applied alongside the variable value. */
  variableExtraDefs?: Record<string, unknown>;
  /** For variable entries: the AST node of the argument. */
  argNode?: any;
  /** For composed Css props inserted via `add(cssProp)`. */
  styleArrayArg?: any;
  /** True when the composed style arg came from `addCss(...)`. */
  isAddCss?: boolean;
  /** The evaluated literal value of the argument, if it was a compile-time constant. */
  argResolved?: string;
  /** For runtime typography lookups: the lookup metadata and runtime key node. */
  typographyLookup?: {
    /** I.e. `"typography"` or `"typography__sm"` for `Css.typography(key).$` in a given condition context. */
    lookupKey: string;
    argNode: any;
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
  markerNode?: any;
}
