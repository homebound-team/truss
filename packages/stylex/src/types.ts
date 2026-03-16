/** The shape of the Css.json mapping file consumed by the Vite plugin. */
export interface TrussMapping {
  increment: number;
  breakpoints?: Record<string, string>;
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
  /** I.e. `{ "kind": "dynamic", "props": ["marginTop"], "incremented": true }` for `Css.mt(v).$`. */
  | { kind: "dynamic"; props: string[]; incremented: boolean; extraDefs?: Record<string, unknown> }
  /** I.e. `{ "kind": "delegate", "target": "mt" }` for `Css.mtPx(v).$`. */
  | { kind: "delegate"; target: string }
  /** I.e. `{ "kind": "alias", "chain": ["f14", "black"] }` for `Css.bodyText.$`. */
  | { kind: "alias"; chain: string[] };

/**
 * A resolved chain segment — one abbreviation resolved to its CSS effect.
 * The plugin collects these while walking a `Css.x.y.z.$` chain.
 */
export interface ResolvedSegment {
  /** The stylex.create entry key (e.g. "df", "black__hover", "mt__16px") */
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
   * If inside a `stylex.when.*` context (e.g. onHoverOf, when("descendant", ...)),
   * the relationship + pseudo selector info. When set, uses
   * `stylex.when.<relationship>(pseudo, marker?)` as the computed property key.
   */
  whenPseudo?: { pseudo: string; markerNode?: any; relationship?: string };
  /** For dynamic entries: the CSS prop names */
  dynamicProps?: string[];
  /** For dynamic entries: whether the value uses maybeInc */
  incremented?: boolean;
  /** For dynamic entries: additional static defs applied alongside the dynamic value */
  dynamicExtraDefs?: Record<string, unknown>;
  /** For dynamic entries: the AST node of the argument */
  argNode?: any;
  /** Whether the arg was a literal we could evaluate */
  argResolved?: string;
  /**
   * If set, this segment represents an unsupported pattern that could not be resolved.
   * The error message describes what went wrong. Valid segments in the same chain
   * are preserved; only this segment is skipped in the output.
   */
  error?: string;
}

/**
 * A "marker" segment — not a CSS style, but a directive to attach
 * `stylex.defaultMarker()` or a user-defined marker to the element.
 */
export interface MarkerSegment {
  type: "marker";
  /** If set, the AST node of the user-provided marker variable (return value of stylex.defineMarker()). Otherwise, default marker. */
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

/** An entry to emit into the file-local stylex.create call */
export interface StylexCreateEntry {
  key: string;
  /** For static entries: the CSS defs object (may include pseudo wrapping) */
  defs?: Record<string, unknown>;
  /** For dynamic entries: the param name(s) and whether it has pseudo wrapping */
  dynamic?: {
    props: string[];
    pseudo: string | null;
  };
}
