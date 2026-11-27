import type { Aliases, Config, UtilityMethod, UtilityName } from "src/config";
import type { Properties } from "csstype";
import { incrementCssValue } from "src/spacing-css-var";
import type { TrussMappingEntry } from "src/truss-mapping";

export type Prop = keyof Properties;

// ── Method Definitions ────────────────────────────────────────────────
// Each helper returns data, not code: the `Css.json` entry the build plugin compiles the method
// with, plus the few details the generator needs to write the `Css.ts` method. `renderMethod` in
// `render-methods.ts` turns a definition into the builder's TypeScript source.

/**
 * One utility method: its name, its `Css.json` entry, and what the generator needs to write it.
 *
 * I.e. `newMethod("df", { display: "flex" })` returns
 * `{ abbr: "df", entry: { kind: "static", defs: { display: "flex" } } }`, which the generator
 * writes to `Css.ts` as `get df() { ... }` and to `Css.json` as `"df": { "kind": "static", ... }`.
 */
export interface MethodDefinition {
  /** The builder member and the `Css.json` key, i.e. `mt0`. */
  abbr: UtilityName;
  /** How the build plugin resolves `abbr`, written to `Css.json` as-is. */
  entry: TrussMappingEntry;
  /** The config key `abbr` is named after; absent when a `newMethod` call spells the name. */
  namedAfter?: ConfigKey;
  /** How to write the builder method, where `entry` alone does not say. */
  source?: MethodSource;
  /**
   * The `Css.json` entry for the target of a `delegate` that no other method generates.
   *
   * I.e. `sqPx` delegates to `sq`, but there is no `Css.sq(value)` method, so `sq` only exists in
   * `Css.json`, to give the plugin the props that `sqPx` sets.
   */
  delegateTarget?: TrussMappingEntry;
}

/**
 * The details of a builder method that its `Css.json` entry does not carry.
 *
 * - `px`: a `delegate` entry only names its target, so this gives the props for the doc comment,
 *   and whether the method calls its target (i.e. `mhPx(px)` calls `this.mh(...)`) or sets each
 *   prop itself (i.e. `mtPx(px)` calls `add("marginTop", ...)`).
 * - `cssVariables`: a `static` entry that sets custom properties, which csstype does not type, so
 *   the method casts each name and has no doc comment.
 */
export type MethodSource = { kind: "px"; props: Prop[]; callsTarget: boolean } | { kind: "cssVariables" };

/**
 * A key in one of the user's config maps that a method takes its name from.
 *
 * I.e. `palette: { Bg: ... }` spells `bg`, `aliases: { bodyText: ... }` spells `bodyText`, and
 * `keyframes: { spin: ... }` spells `spin`. Renaming one of these methods means editing that key,
 * so an error about `bg` can say "palette entry `Bg`" instead of naming the `skins` section, which
 * the user never wrote.
 *
 * A method that a `newMethod` call spells has no `ConfigKey`, whether the call is in a built-in
 * section or in a section of the user's own. `MethodSection.custom` is what tells those apart.
 */
export interface ConfigKey {
  kind: "palette" | "alias" | "keyframe";
  name: string;
}

/**
 * The section a method is generated in, and whether the user's config defines that section.
 *
 * `custom` is how we tell a method the user wrote in their own section from a built-in one, for
 * the methods that no `ConfigKey` spells.
 */
export interface MethodSection {
  name: string;
  custom: boolean;
}

/**
 * The methods one section function returned, tagged with the section the generator called.
 *
 * A custom section may still return hand-written method strings, so `methods` can hold both.
 */
export interface GeneratedSection {
  section: MethodSection;
  methods: UtilityMethod[];
}

/**
 * Given a single abbreviation (i.e. `mt0`) and multiple `{ prop: value }` CSS values, returns
 * a `mt0` utility method that sets those values.
 *
 * Pass `namedAfter` when a key the user wrote in their config is what spells the method's name,
 * i.e. a palette key, so an error can name that key instead of the section the method comes from.
 */
export function newMethod(abbr: UtilityName, defs: Properties, namedAfter?: ConfigKey): MethodDefinition {
  return { abbr, entry: { kind: "static", defs: { ...defs } }, namedAfter };
}

/**
 * Given a single abbreviation (i.e. `mt`) and a property name (i.e. `marginTop`), returns a `mt`
 * utility method that accepts a user-provided value of the prop to set.
 * Use `extraProperties` for additional properties to set.
 *
 * I.e. `Css.mt(someValue).$`
 */
export function newParamMethod(
  abbr: UtilityName,
  prop: keyof Properties,
  extraProperties: Properties = {},
): MethodDefinition {
  const extraDefs = Object.keys(extraProperties).length > 0 ? { ...extraProperties } : undefined;
  return { abbr, entry: { kind: "variable", props: [prop], incremented: false, extraDefs } };
}

/**
 * Given a prop to set (i.e. `marginTop`), and multiple abbr/value pairs (i.e. `{ mt0: "0px", mt1: "4px" }`),
 * returns a utility method for each abbr/value pair.
 *
 * I.e. `mt0() { ...add("marginTop", "0px")... }`
 *
 * By default, we also generate a param method for `prop`, i.e. if `prop` is `marginTop`, we'll
 * make a `marginTop(value)` method for users to pass variable values. You can change the
 * name of this method by setting `baseName` or disable it completely by setting `baseName`
 * to `null`.
 *
 * @param prop the CSS property we're setting, i.e. `marginTop`
 * @param defs a map of abbreviation name --> value (a property value or an object of properties to set)
 * @param baseName the base name to use, i.e. `mt`
 * @param includePx generate an extra `${baseName}Px` method that calls the base method with a converted px value
 * @param baseDefs additional properties to set for the base method
 */
export function newMethodsForProp<P extends Prop>(
  prop: P,
  defs: Record<UtilityName, Properties[P] | Properties>,
  baseName: string | null = prop,
  includePx: boolean = false,
  valueMethodExtraProperties?: Omit<Properties, P>,
): MethodDefinition[] {
  return [
    ...Object.entries(defs).map(([abbr, value]) =>
      newMethod(
        abbr,
        // If the value is an object, use it as the full defs, otherwise, use it as the prop value
        typeof value === "object" ? value : { [prop]: value },
      ),
    ),
    // Conditionally add a method that directly accepts a value for prop
    ...(baseName !== null ? [newParamMethod(baseName, prop, valueMethodExtraProperties)] : []),
    ...(baseName !== null && includePx ? [newPxMethod(baseName, prop)] : []),
  ];
}

/**
 * Given a keyframe abbreviation (i.e. `sweep`) and its `@keyframes` name, returns a `sweep`
 * utility method that puts the name in front of the animation shorthand.
 *
 * I.e. `Css.sweep("1.6s linear infinite").$` sets `animation: sweep 1.6s linear infinite`.
 */
export function newKeyframeMethod(abbr: UtilityName, name: string): MethodDefinition {
  return { abbr, entry: { kind: "keyframe", name }, namedAfter: { kind: "keyframe", name } };
}

/**
 * Given aliases, i.e. `{ bodyText: ["f12", "bold"] }`, returns a utility method
 * for each alias that calls its corresponding utility classes.
 */
export function newAliasesMethods(aliases: Aliases): MethodDefinition[] {
  return Object.entries(aliases).map(([abbr, values]) => ({
    abbr,
    entry: { kind: "alias", chain: values },
    namedAfter: { kind: "alias", name: abbr },
  }));
}

/**
 * Makes a utility method that can set CSS custom variables.
 *
 * I.e. `newSetCssVariableMethod("dark", { "--Primary": "white" })` will create a
 * utility method `Css.dark.$ that will set `--Primary` to `white`.
 *
 * Currently, this only supports compile-time/hard-coded values. I.e. we don't support
 * something like `Css.dark({ "--Primary", someRuntimeValue }).$` yet.
 *
 * TODO: Create a `Css.set(cssVars).$` method.
 */
export function newSetCssVariablesMethod(abbr: UtilityName, defs: Record<string, string>): MethodDefinition {
  // The plugin compiles it like any other static method; only the `Css.ts` source differs.
  return { abbr, entry: { kind: "static", defs: { ...defs } }, source: { kind: "cssVariables" } };
}

/** An abbreviation and its single or multiple CSS properties to set. */
export type IncConfig = [string, Prop | Prop[]];

/**
 * Makes [`mt0`, `mt1`, ...] utility methods for each configured increment
 * to set `prop` to that given increment's value in pixels.
 *
 * I.e. we assume `prop` is a CSS property like `margin` that accepts pixels as values,
 * and so convert each increment `x` (1, 2, 3) to pixels `Y` (8, 16, 24) and create
 * a utility method for each `x -> Y` pair, i.e. `mt0 = mt(px(0))`.
 *
 * We also create a final param method, i.e. `mt(number)`, for callers that
 * need to call `mt` with a conditional amount of increments.
 *
 * @param config the config
 * @param abbr the utility prefix, i.e. `mt`
 * @param props if a CSS prop like `marginTop`, we output "mt0 --> marginTop: 0px", if an array like
 *   `["marginTop", "marginBottom"]`, we output "my0 --> marginTop: 0px, marginBottom: 0px"
 * @param opts.auto if set to true, include an `a` suffix for auto values, i.e. `mta`
 */
export function newIncrementMethods(
  config: Config,
  abbr: UtilityName,
  prop: Prop | Prop[],
  opts: { auto?: boolean } = {},
): MethodDefinition[] {
  // Create `m1`, `m2`, etc. that will call our main `m` method.
  const props = typeof prop === "string" ? [prop] : prop;
  const delegateMethods = newCoreIncrementMethods(config, abbr, props);

  return [
    ...delegateMethods,
    ...(opts.auto ? [newMethod(`${abbr}a`, Object.fromEntries(props.map((p) => [p, "auto"])))] : []),
    // `mt(v)` goes through `maybeInc`, so a number is a count of increments and a string is used as-is
    { abbr, entry: { kind: "variable", props, incremented: true } },
    // `mtPx(px)` sets each prop itself, but its mapping still delegates to `mt` for the props
    {
      abbr: `${abbr}Px`,
      entry: { kind: "delegate", target: abbr },
      source: { kind: "px", props, callsTarget: false },
    },
  ];
}

/**
 * Creates just the core `<abbr>X` utility methods that set `props` with each increment value.
 *
 * See `newIncrementMethods` for handling the `<abbr>Px`, `<abbr>a`, and `<attr>(value)` methods.
 */
export function newCoreIncrementMethods(config: Config, abbr: UtilityName, props: Prop[]): MethodDefinition[] {
  return zeroTo(config.numberOfIncrements).map((i) => {
    // The web target scales one `--t-spacing` variable, while React Native has no CSS variables
    const value = isWebIncrementTarget(config) ? incrementCssValue(i) : `${i * config.increment}px`;
    return newMethod(`${abbr}${i}`, Object.fromEntries(props.map((p) => [p, value])));
  });
}

/** Makes a `<abbr>Px(px)` method that calls the existing `<abbr>(value)` method with a px value. */
export function newPxMethod(abbr: UtilityName, prop: Prop): MethodDefinition {
  return {
    abbr: `${abbr}Px`,
    entry: { kind: "delegate", target: abbr },
    source: { kind: "px", props: [prop], callsTarget: true },
  };
}

/**
 * Makes a `<abbr>Px(px)` method that sets several props, without a `<abbr>(value)` method.
 *
 * I.e. `newPxMethods("sq", ["height", "width"])` makes `sqPx(px)`. Its `Css.json` entry still
 * delegates to `sq`, so `sq` is given an entry of its own there, as `delegateTarget`.
 */
export function newPxMethods(abbr: UtilityName, props: Prop[]): MethodDefinition[] {
  return [
    {
      abbr: `${abbr}Px`,
      entry: { kind: "delegate", target: abbr },
      source: { kind: "px", props, callsTarget: false },
      delegateTarget: { kind: "variable", props, incremented: false },
    },
  ];
}

export const zeroTo: (n: number) => number[] = (n) => [...Array(n + 1).keys()];

/** Whether increments are written as `--t-spacing` multiples, which only the web target supports. */
function isWebIncrementTarget(config: Config): boolean {
  return config.target !== "react-native";
}
