/**
 * Web increment utilities use `--t-spacing` with `calc` (see generated `Css.ts` and the Vite plugin).
 * Keep literals in one place so codegen, emitted CSS, and the transform stay aligned.
 * `--t-spacing` must be set (e.g. `:root` prelude from `collectCss()` / mapping `increment`).
 */

/** Custom property for increment-based spacing (web). */
export const TRUSS_SPACING_CUSTOM_PROPERTY = "--t-spacing";

/** I.e. `calc(var(--t-spacing) * 3)` — requires prelude defining `--t-spacing`. */
export function trussWebIncrementCssValue(multiplier: number): string {
  return `calc(var(${TRUSS_SPACING_CUSTOM_PROPERTY}) * ${multiplier})`;
}

/**
 * If `cssValue` is exactly `calc(var(--t-spacing) * k)` for this package's spacing property,
 * returns the multiplier substring `k` (e.g. `"2"`, `"-1"`, `"2.5"`). Otherwise null.
 * This is an attempt to match custom values to pre-built class names (.e.g try to match `Css.("calc(var(--t-spacing) * 2").$` to `mt_2`)
 */
export function trussWebTryParseIncrementCalcMultiplier(cssValue: string): string | null {
  const prop = TRUSS_SPACING_CUSTOM_PROPERTY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^calc\\(var\\(${prop}\\) \\* (-?\\d+(?:\\.\\d+)?)\\)$`);
  const m = cssValue.match(re);
  return m ? m[1] : null;
}

/** Prepended to emitted Truss CSS; `incrementPx` comes from `truss-config` / `Css.json`. */
export function trussWebRootSpacingPreludeCss(incrementPx: number): string {
  return `:root { ${TRUSS_SPACING_CUSTOM_PROPERTY}: ${incrementPx}px; }`;
}
