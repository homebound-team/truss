import { Properties } from "csstype";
import { Code } from "ts-poet";

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
 * Truss's built-in rules, i.e. `typeScale.ts` for fonts, `skins.ts` for colors,
 * will read these values to determine their output.
 *
 * Note that users can always override whole sections of Truss's default set
 * of rules by setting `methods["typeScale"] = {}`, see the readme for more
 * information.
 */
export interface Config {
  /** The output path of the `Css.ts` file. */
  outputPath: string;

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

  /** The design system's increment in pixels. */
  increment: number;

  /** The number of increments to generate for rules like `mt1`, `mt2`, etc. */
  numberOfIncrements: number;

  /** Short-hand aliases like `bodyText` --> `["f12", "black"]`. */
  aliases?: Aliases;

  /** Type aliases for Only clauses, i.e. `Margin` --> `["marginTop", ...]`. `Margin` and `Padding` are provided. */
  typeAliases?: Record<string, Array<keyof Properties>>;

  /** Breakpoints, i.e. `{ sm: 0, md: 500 }`. */
  breakpoints?: Record<string, number>;

  /**
   * Which default methods to include.
   *
   * Currently, we support either `tachyons`, `tachyons-rn`, or `none`.
   * Could eventually support `tailwinds` / `tailwinds-rn` as additional options.
   */
  defaultMethods?: "tachyons" | "none" | "tachyons-rn";

  /**
   * A map of "section" to list of rules to create application-specific
   * utility methods.
   *
   * I.e. "borderColors" -> () => [`get ml1() { ... }`].
   *
   * This can be used to either add new sections or override built-in sections.
   */
  sections?: Sections;

  /** Any extra chunks of code you want appended to the end of the file. */
  extras?: Array<string | Code>;
}

/**
 * A helper method to define config w/o a trailing cast.
 *
 * Based on `vite.config.ts`'s approach.
 *
 * We could eventually use this as a place to apply defaults, but currently
 * just return the passed in `config` object as-is.
 */
export function defineConfig(config: Config): Config {
  return config;
}

/**
 * A function takes the project's `Config` and produces a list of utility methods to
 * add to the generated `Css.ts` file.
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
 * See the `newMethod` and `newParamMethod` functions for more easily
 * creating the `get ...() { ... }` output.
 */
export type CreateMethodsFn = (config: Config) => UtilityMethod[];

/**
 * A type-alias to clarify strings that are meant to be abbreviation/utility names.
 */
export type UtilityName = string;

/**
 * A type-alias to clarify which method returns types are utility methods.
 *
 * I.e. they should be a line of TypeScript code like `get abbr() { ... }`.
 *
 * See `newMethod` for a helper method to create the string.
 */
export type UtilityMethod = string;

/** A type-alias to clarify groups of utility methods. */
export type SectionName = string;

/** A type-alias for a group of utility methods. */
export type Sections = Record<SectionName, CreateMethodsFn>;

/** A type-alias for aliasing existing utility methods as a new utility method. */
export type Aliases = Record<UtilityName, UtilityName[]>;
