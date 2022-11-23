import { Aliases, Config, UtilityMethod, UtilityName } from "src/config";
import { Properties } from "csstype";

export type Prop = keyof Properties;

/**
 * Given a single abbreviation (i.e. `mt0`) and multiple `{ prop: value }` CSS values, returns
 * the TypeScript code for a `mt0` utility method that sets those values.
 */
export function newMethod(abbr: UtilityName, defs: Properties): UtilityMethod {
  return `${comment(defs)} get ${abbr}() { return this${Object.entries(defs)
    .map(([prop, value]) => `.add("${prop}", ${maybeWrap(value)})`)
    .join("")}; }`;
}

/**
 * Given a single abbreviation (i.e. `mt`) and a property name (i.e. `marginTop`), returns the
 * TypeScript code for a `mt` utility method that accepts a user-provided value of the prop to set.
 *
 * I.e. `Css.mt(someValue).$`
 */
export function newParamMethod(abbr: UtilityName, prop: keyof Properties): UtilityMethod {
  return `${comment({ [prop]: "value" })} ${abbr}(value: Properties["${prop}"]) { return this.add("${prop}", value); }`;
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
 * @param defs a map of abbreviation name --> value
 * @param baseName the base name to use, i.e. `mt`
 * @param includePx generate an extra `${baseName}Px` method that calls the base method with a converted px value
 */
export function newMethodsForProp<P extends Prop>(
  prop: P,
  defs: Record<UtilityName, Properties[P]>,
  baseName: string | null = prop,
  includePx: boolean = false,
): UtilityMethod[] {
  return [
    ...Object.entries(defs).map(([abbr, value]) => newMethod(abbr, { [prop]: value })),
    // Conditionally add a method that directly accepts a value for prop
    ...(baseName !== null ? [newParamMethod(baseName, prop)] : []),
    ...(baseName !== null && includePx ? [newPxMethod(baseName, prop)] : []),
  ];
}

/**
 * Given aliases, i.e. `{ bodyText: ["f12", "bold"] }`, returns a utility method
 * for each alias that calls its corresponding utility classes.
 */
export function newAliasesMethods(aliases: Aliases): UtilityMethod[] {
  return Object.entries(aliases).map(([abbr, values]) => {
    return `get ${abbr}() { return this${values.map((v) => `.${v}`).join("")}; }`;
  });
}

/**
 * Makes a utility method that can set CSS custom variables.
 *
 * I.e. `newSetCssVariableMethod("dark", { "--Primary": "white" })` will create a
 * utility method `Css.dark.$ that will set `--Primary` to `white`.
 *
 * Currently this only supports compile-time/hard-coded values. I.e. we don't support
 * something like `Css.dark({ "--Primary", someRuntimeValue }).$` yet.
 *
 * TODO: Create a `Css.set(cssVars).$` method.
 */
export function newSetCssVariablesMethod(abbr: UtilityName, defs: Record<string, string>): UtilityMethod {
  return `get ${abbr}() { return this${Object.entries(defs)
    .map(([prop, value]) => `.add("${prop}" as any, "${value}")`)
    .join("")}; }`;
}

// For any "increment" abbreviation, maps the abbreviation, i.e. "mt",
// to its longName or N other increment abbreviation that it composes.
export type IncConfig = [string, Prop | string[]];

/**
 * Makes [`mt0`, `mt1`, ...] utility methods for each configured increment
 * to set `prop` to that given increment's value in pixels.
 *
 * I.e. we assume that `prop` is a CSS property that accepts pixels as values, and
 * so convert each increment `x` (1, 2, 3) to pixels `Y` (8, 16, 24) and create
 * a utility method for each `x -> Y` pair, i.e. `mt0 = mt(px(0))`.
 *
 * We also create a final param method, i.e. `mt(number)`, for callers that
 * need to call `mt` with a conditional amount of increments.
 *
 * TODO: Support non-pixel increments.
 *
 * @param config the config
 * @param abbr the utility prefix, i.e. `mt`
 * @param conf if a CSS prop, we assume "mt0 --> marginTop: 0px", otherwise if an array we delegate
 *   to other existing utility methods, i.e. `m0` -> `mx0.my0`.
 */
export function newIncrementMethods(config: Config, abbr: UtilityName, conf: Prop | string[]): UtilityMethod[] {
  // Create `m1`, `m2`, etc. that will call our main `m` method.
  const delegateMethods = newIncrementDelegateMethods(config, abbr, typeof conf === "string" ? conf : (conf as Prop[]));
  if (Array.isArray(conf)) {
    return [
      ...delegateMethods,
      `${abbr}(inc: number | string) { return this.${conf.map((l) => `${l}(inc)`).join(".")}; }`,
      `${abbr}Px(px: number) { return this.${conf.map((l) => `${l}Px(px)`).join(".")}; }`,
    ];
  } else {
    return [
      ...delegateMethods,
      `${comment({ [conf]: "inc" })} ${abbr}(inc: number | string) { return this.add("${conf}", maybeInc(inc)); }`,
      newPxMethod(abbr, conf),
    ];
  }
}

/** Creates `<abbr>X` utility methods that call an `abbr(number)` that the caller is responsible for creating. */
export function newIncrementDelegateMethods(config: Config, abbr: UtilityName, prop: Prop | Prop[]): UtilityMethod[] {
  return zeroTo(config.numberOfIncrements).map((i) => {
    const px = `${i * config.increment}px`;
    const defs = typeof prop === "string" ? { [prop]: px } : Object.fromEntries(prop.map((prop) => [prop, px]));
    return `${comment(defs)} get ${abbr}${i}() { return this.${abbr}(${i}); }`;
  });
}

export function newPxMethod(abbr: UtilityName, prop: Prop): UtilityMethod {
  return `${comment({ [prop]: "px" })} ${abbr}Px(px: number) { return this.${abbr}(\`\${px}px\`); }`;
}

export const zeroTo: (n: number) => number[] = (n) => [...Array(n + 1).keys()];

/** Keeps numbers as literals, and wraps anything else with double quotes. */
function maybeWrap(value: unknown): string {
  return typeof value === "number" ? String(value) : `"${value}"`;
}

export function comment(defs: object): string {
  const paramNames = ["value", "px", "inc"];
  const values = Object.entries(defs)
    .map(([prop, value]) => `${prop}: ${paramNames.includes(value) ? value : maybeWrap(value)}`)
    .join("; ");
  return `/** Sets \`${values}\`. */\n`;
}
