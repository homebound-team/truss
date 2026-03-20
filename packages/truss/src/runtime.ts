import type * as stylex from "@stylexjs/stylex";

export function mergeProps(
  stylexNs: typeof stylex,
  explicitClassName: string,
  ...styles: Array<Parameters<typeof stylex.props>[number]>
): Record<string, unknown> {
  const sx = stylexNs.props(...styles);
  return {
    ...sx,
    className: `${explicitClassName} ${sx.className ?? ""}`.trim(),
  };
}

export function asStyleArray(styles: unknown): ReadonlyArray<unknown> {
  if (Array.isArray(styles)) {
    return styles;
  }
  return styles ? [styles] : [];
}
