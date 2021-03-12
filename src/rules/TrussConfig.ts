import { Properties } from "csstype";

/**
 * A rule takes the project's `TrussConfig` and produces a list
 * of ~one-liner TypeScript code to add to the generated `Css.ts`
 * file.
 *
 * I.e. a return value might be:
 *
 * ```
 *   [
 *     "get mb0() { return this.mb(0); }",
 *     "get mb1() { return this.mb(1); }",
 *   ]
 * ```
 *
 * See the `makeRule` and `makeRules` functions for more easily
 * creating the `get ...() { ... }` output.
 */
export type RuleFn = (config: TrussConfig) => string[];

/**
 * A map from human name to font size, i.e. `f12` -> `12px`.
 *
 * Or a set of properties, i.e. `f12` -> `{ fontFamily: ..., fontWeight: ... }`.
 */
export type FontConfig = Record<string, string | Properties>;

/**
 * Provides users with an easy way to configure the major/most-often configurable
 * aspect of a design system, i.e. the palette, fonts, and increments.
 *
 * Truss's built-in rules, i.e. `type-scale.ts` for fonts, `skins.ts` for colors,
 * will read these values to determine their output.
 *
 * Note that users can always override whole sections of Truss's default set
 * of rules by setting `methods["typeScale"] = {}`, see the readme for more
 * information.
 */
export interface TrussConfig {
  /**
   * A map from the human/design system name to color value, i.e. `black` -> `#000000`.
   *
   * Design systems can use either physical names, i.e. `Sky50 -> #...`, or logical
   * names, i.e. `Primary -> #...`, where the logical names are more themeable, but
   * that's up to each design system to decide.
   */
  palette: Record<string, string>;

  /**
   * A map from human name to font size, i.e. `f12` -> `12px`.
   *
   * Or a set of properties, i.e. `f12` -> `{ fontFamily: ..., fontWeight: ... }`.
   */
  fonts: FontConfig;

  /** The number of increments to generate for rules like `mt1`, `mt2`, etc. */
  numberOfIncrements: number;
}
