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
 * The plugin collects these while walking a `Css.x.y.z.$` chain.
 */
export interface ResolvedSegment {
  /** The emitted entry key (e.g. "df", "black__hover", "mt__16px") */
  key: string;
  /** The CSS property defs for this segment */
  defs: Record<string, unknown>;
  /** If inside a media query context (e.g. "@media screen and (max-width:599px)") */
  mediaQuery?: string | null;
  /** If inside a pseudo-class context (e.g. ":hover", ":focus") */
  pseudoClass?: string | null;
  /** If inside a pseudo-element context (e.g. "::placeholder", "::selection") — becomes a top-level key in the stylex.create namespace */
  pseudoElement?: string | null;
  /**
   * If inside a `when()` relationship selector context, the relationship + pseudo selector info.
   */
  whenPseudo?: { pseudo: string; markerNode?: any; relationship?: string };
  /** For variable entries: the CSS prop names */
  variableProps?: string[];
  /** For variable entries: whether the value uses maybeInc */
  incremented?: boolean;
  /** For variable Px delegates: whether the runtime value must append `px` */
  appendPx?: boolean;
  /** For variable entries: additional static defs applied alongside the variable value */
  variableExtraDefs?: Record<string, unknown>;
  /** For variable entries: the AST node of the argument */
  argNode?: any;
  /** For composed Css props inserted via `add(cssProp)` */
  styleArrayArg?: any;
  /** Whether the arg was a literal we could evaluate */
  argResolved?: string;
  /** For runtime typography lookups: the lookup metadata and runtime key node */
  typographyLookup?: {
    /** I.e. `"typography"` or `"typography__sm_hover"` for `Css.typography(key).$` in a given condition context. */
    lookupKey: string;
    argNode: any;
    /** I.e. `{ f14: [{ key: "f14", defs: { fontSize: "14px" } }], f10: [{ key: "f10", defs: { fontSize: "10px", fontWeight: 500 } }] }`. */
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

/** A fully analyzed Css expression site in the source file. */
export interface CssExpressionSite {
  /** The resolved segments for this expression */
  segments: ResolvedSegment[];
  /** Whether this is a conditional expression (if/else) */
  conditional?: {
    conditionNode: any;
    thenSegments: ResolvedSegment[];
    elseSegments: ResolvedSegment[];
  };
}

/** Legacy emitted entry shape retained for type compatibility. */
export interface StylexCreateEntry {
  key: string;
  /** For static entries: the CSS defs object (may include pseudo wrapping) */
  defs?: Record<string, unknown>;
  /** For variable entries: the param name(s) and whether it has pseudo wrapping */
  variable?: {
    props: string[];
    pseudo: string | null;
  };
}
