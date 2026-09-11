import { Properties } from "csstype";
import { Code } from "ts-poet";

/**
 * A map from human name to font size, i.e. `f12` -> `12px`.
 *
 * Or a set of properties, i.e. `f12` -> `{ fontFamily: ..., fontWeight: ... }`.
 */
export type FontConfig = Record<string, string | Properties>;

/**
 * Maps a design token name (enum member / key) to a CSS custom property name.
 * Values must be valid custom property identifiers (`--…`).
 *
 * The object form additionally registers the property with `@property`, i.e. so the browser
 * types the value and can animate it. See `TokenDefinition`.
 */
export type TokenRegistry = Record<string, `--${string}` | TokenDefinition>;

/**
 * A token that is also registered with `@property`.
 *
 * Naming a token and registering it are two different things. The string form of `tokens` only
 * gives the variable a TypeScript name and emits no CSS. Registering it tells the browser about
 * the variable: to parse and type-check its value, to fall back to `initialValue` instead of
 * inheriting an unparsed token stream, and — the reason most design systems want it — to
 * *interpolate* it, since an unregistered custom property is an opaque token stream that no
 * transition or keyframe can animate.
 *
 * I.e. `{ var: "--angle", syntax: "<angle>", inherits: false, initialValue: "0deg" }` emits
 * `@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }`.
 */
export interface TokenDefinition {
  /** The CSS custom property name, i.e. `--angle`. */
  var: `--${string}`;
  /** The `@property` syntax descriptor, i.e. `"<angle>"`, or `"*"` to register without typing. */
  syntax: string;
  /** The `@property` inherits descriptor. Defaults to `false`. */
  inherits?: boolean;
  /** The `@property` initial-value descriptor, i.e. `"0deg"`. Required unless `syntax` is `"*"`. */
  initialValue?: string;
}

/**
 * A map from `@keyframes` name to its animation timeline.
 *
 * The object form is keyframe selector (`from`, `to`, `50%`, `0%, 100%`) to declarations, which
 * csstype validates like any other declaration. The string form is a raw body, for a timeline the
 * typed form cannot express. Either way Truss owns the name, so it can check the animations that
 * use it and write the block only when one still does.
 *
 * `null` declares a name that some other stylesheet defines — a global CSS file, a third-party
 * package. Truss accepts the name and writes nothing. Without it, adopting `keyframes` at all would
 * make every animation Truss did not declare fail the build.
 *
 * I.e. `{ spin: { to: { transform: "rotate(360deg)" } }, aiStarLoader: null }`.
 */
export type KeyframesConfig = Record<string, Record<string, KeyframeDeclarations> | string | null>;

/**
 * The declarations in one keyframe selector.
 *
 * Custom properties are allowed alongside real CSS properties, because animating a registered
 * property is written as a keyframe that sets it, i.e. `{ to: { "--angle": "360deg" } }`.
 */
export type KeyframeDeclarations = Properties & { [customProperty: `--${string}`]: string | number };

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
   * Optional design tokens: emitted as `Tokens` enum in generated `Css.ts` and available to
   * `Css.setVar({ [Tokens.X]: … })` at build time (web target).
   */
  tokens?: TokenRegistry;

  /**
   * Optional `@keyframes` animations: emitted as a `Keyframes` enum in generated `Css.ts` (web
   * target), and written to the stylesheet only while some rule still names them.
   */
  keyframes?: KeyframesConfig;

  /**
   * Which default methods to include.
   *
   * Currently, we support either `tachyons`, `tachyons-rn`, or `none`.
   * Could eventually support `tailwinds` / `tailwinds-rn` as additional options.
   */
  defaultMethods?: "tachyons" | "none" | "tachyons-rn";

  /**
   * The target CSS runtime to generate for.
   *
   * - `"web"` (default): Generates a web CssBuilder (for IDE autocomplete + types) plus a
   *   `Css.json` mapping file consumed by the truss Vite plugin, which compiles
   *   `Css.*.$` expressions into atomic CSS output at build time.
   * - `"react-native"`: Generates a runtime CssBuilder that accumulates plain style objects,
   *   intended for React Native usage.
   */
  target?: "react-native" | "web";

  /**
   * The output path for the truss mapping file (only used when target is "web").
   * Defaults to a `.json` sibling of `outputPath` (e.g. `./src/Css.json`).
   */
  mappingOutputPath?: string;

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
