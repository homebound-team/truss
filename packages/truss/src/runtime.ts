import type * as stylex from "@stylexjs/stylex";

export class TrussDebugInfo {
  /** A compact `FileName.tsx:line` source label for a Truss CSS expression. */
  readonly src: string;

  constructor(src: string) {
    this.src = src;
  }
}

type StylexPropArg = Parameters<typeof stylex.props>[number];

/** Call StyleX while stripping Truss debug sentinels from the style list. */
export function trussProps(stylexNs: typeof stylex, ...styles: unknown[]): Record<string, unknown> {
  const { debugSources, styleArgs } = splitDebugInfo(styles);
  const sx = stylexNs.props(...styleArgs);
  return applyDebugSources(sx, debugSources);
}

export function mergeProps(
  stylexNs: typeof stylex,
  explicitClassName: string,
  ...styles: unknown[]
): Record<string, unknown> {
  const { debugSources, styleArgs } = splitDebugInfo(styles);
  const sx = stylexNs.props(...styleArgs);
  return {
    ...applyDebugSources(sx, debugSources),
    className: `${explicitClassName} ${sx.className ?? ""}`.trim(),
  };
}

/**
 * Coerce maybe-array StyleX inputs into arrays, guarding against nullish/false and plain object values.
 *
 * I.e. `...asStyleArray(xss)` stays safe when destructured `xss` is `undefined`.
 */
export function asStyleArray(styles: unknown): ReadonlyArray<unknown> {
  if (Array.isArray(styles)) {
    return styles;
  }
  // I.e. a single style object/ref like `xss={{ ...Css.blue.$ }}` becomes `[xss]`
  return styles ? [styles] : [];
}

/** Collect Truss debug info while preserving the original StyleX argument order. */
function splitDebugInfo(styles: ReadonlyArray<unknown>): {
  debugSources: string[];
  styleArgs: StylexPropArg[];
} {
  const debugSources: string[] = [];
  const styleArgs: StylexPropArg[] = [];

  for (const style of styles) {
    if (style instanceof TrussDebugInfo) {
      debugSources.push(style.src);
    } else {
      styleArgs.push(style as StylexPropArg);
    }
  }

  return { debugSources, styleArgs };
}

/** Deduplicate and attach compact Truss source labels to emitted props. */
function applyDebugSources(
  props: Record<string, unknown>,
  debugSources: ReadonlyArray<string>,
): Record<string, unknown> {
  if (debugSources.length === 0) {
    return props;
  }

  const uniqueSources = Array.from(new Set(debugSources));
  return {
    ...props,
    "data-truss-src": uniqueSources.join("; "),
  };
}
