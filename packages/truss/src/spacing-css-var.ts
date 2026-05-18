/**
 * Web increment utilities use `--t-spacing` with `calc` (see generated `Css.ts` and the Vite plugin).
 * Keep literals in one place so codegen, emitted CSS, and the transform stay aligned.
 * `--t-spacing` must be set (e.g. `:root` prelude from `collectCss()` / mapping `increment`).
 */

/** Custom property for increment-based spacing (web). */
export const SPACING_CUSTOM_PROPERTY = "--t-spacing";

/** I.e. `calc(var(--t-spacing) * 3)` — requires prelude defining `--t-spacing`. */
export function incrementCssValue(multiplier: number): string {
  return `calc(var(${SPACING_CUSTOM_PROPERTY}) * ${multiplier})`;
}

/**
 * If `cssValue` is exactly `calc(var(--t-spacing) * k)` for this package's spacing property,
 * returns the multiplier substring `k` (e.g. `"2"`, `"-1"`, `"2.5"`). Otherwise null.
 */
export function tryParseIncrementCalcMultiplier(cssValue: string): string | null {
  const prop = SPACING_CUSTOM_PROPERTY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^calc\\(var\\(${prop}\\) \\* (-?\\d+(?:\\.\\d+)?)\\)$`);
  const m = cssValue.match(re);
  return m ? m[1] : null;
}

/** Prepended to emitted Truss CSS; `incrementPx` comes from `truss-config` / `Css.json`. */
export function rootSpacingPreludeCss(incrementPx: number): string {
  return `:root { ${SPACING_CUSTOM_PROPERTY}: ${incrementPx}px; }`;
}

/**
 * If `value` is a CSS custom property name (`--token`), wrap as `var(--token)` for use as a property value.
 * Passes through values that are not custom-property names (including existing `var(...)`).
 */
export function maybeCssVar<T>(value: T): T {
  if (typeof value !== "string") return value;
  if (value.startsWith("--")) return `var(${value})` as T;
  return value;
}
