/**
 * Utilities for CSS custom properties (`--token`) in Truss style values.
 */

/**
 * If `value` is a custom property name (`--token`), wrap as `var(--token)` for use as a property value.
 * Passes through values that are not custom-property names (including existing `var(...)`).
 */
export function maybeCssVar<T>(value: T): T {
  if (typeof value !== "string") return value;
  if (value.startsWith("--")) return `var(${value})` as T;
  return value;
}
