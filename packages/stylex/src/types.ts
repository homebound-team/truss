/** The shape of the Css.json mapping file consumed by the Vite plugin. */
export interface TrussMapping {
  increment: number;
  breakpoints?: Record<string, string>;
  abbreviations: Record<string, TrussMappingEntry>;
}

export type TrussMappingEntry =
  | { kind: "static"; defs: Record<string, unknown> }
  | { kind: "dynamic"; props: string[]; incremented: boolean }
  | { kind: "delegate"; target: string }
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
  /** If inside a pseudo context, the pseudo selector (e.g. ":hover") */
  pseudo: string | null;
  /**
   * If inside an ancestor pseudo context (e.g. onHoverOf), the ancestor
   * selector info. When set, uses `stylex.when.ancestor(pseudo, marker?)`
   * as the computed property key instead of a plain pseudo string.
   */
  ancestorPseudo?: { pseudo: string; marker?: string };
  /** For dynamic entries: the CSS prop names */
  dynamicProps?: string[];
  /** For dynamic entries: whether the value uses maybeInc */
  incremented?: boolean;
  /** For dynamic entries: the AST node of the argument */
  argNode?: any;
  /** Whether the arg was a literal we could evaluate */
  argResolved?: string;
}

/**
 * A "marker" segment — not a CSS style, but a directive to attach
 * `stylex.defaultMarker()` or a named `stylex.defineMarker()` to the element.
 */
export interface MarkerSegment {
  type: "marker";
  /** If set, a named marker (uses stylex.defineMarker). Otherwise, default marker. */
  name?: string;
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
