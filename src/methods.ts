import { Aliases, Config, UtilityMethod, UtilityName } from "config";
import { Properties } from "csstype";

export type Prop = keyof Properties;

/**
 * Given a prop (i.e. `marginTop`), and multiple abbreviation/value pairs (i.e. `mt0 = 0px`,
 * `mt1 = 4px`), returns TypeScript methods for each abbreviation.
 */
export function newMethodsForProp<P extends Prop>(
  prop: P,
  defs: Record<UtilityName, Properties[P]>,
  paramMethodName?: string
): UtilityMethod[] {
  return [
    ...Object.entries(defs).map(([abbr, value]) =>
      newMethod(abbr, { [prop]: value })
    ),
    // Conditionally add a method that directly accepts a value for prop
    ...(paramMethodName ? [newParamMethod(paramMethodName, prop)] : []),
  ];
}

/**
 * Given a single abbreviation (i.e. `mt0`) and multiple `prop` -> `value` CSS values, returns the
 * TypeScript for the `mt0` utility method in the Truss output.
 */
export function newMethod(abbr: UtilityName, defs: Properties): UtilityMethod {
  return `get ${abbr}() { return this${Object.entries(defs)
    .map(([prop, value]) => `.add("${prop}", ${maybeWrap(value)})`)
    .join("")}; }`;
}

/**
 * Given a property name `prop` (i.e. `marginTop`), returns a method named `abbr` (i.e. `mt`)
 * that accepts a user-defined value of what to set the prop.
 *
 * I.e. `Css.mt(someValue).$`
 *
 * The `value` parameter's type will be the csstype value for the given `prop`.
 */
export function newParamMethod(
  abbr: UtilityName,
  prop: keyof Properties
): UtilityMethod {
  return `${abbr}(value: Properties["${prop}"]) { return this.add("${prop}", value); }`;
}

/**
 * Given a record of aliases, i.e. `aliasName -> otherUtilityClasses[]`, returns
 * a new TypeScript utility method for each alias.
 */
export function newAliasesMethods(aliases: Aliases): UtilityMethod[] {
  return Object.entries(aliases).map(([abbr, values]) => {
    return `get ${abbr}() { return this${values
      .map((v) => `.${v}`)
      .join("")}; }`;
  });
}

/**
 * Makes a method that can set CSS custom values.
 *
 * I.e. `newSetCssVariableMethod("foo", { "--Foo": "bar" })` will create a
 * utility method `Css.foo.$ that will set `--Foo` to `bar`.
 *
 * Currently this only supports compile-time/hard-coded values. I.e. we don't support
 * something like `Css.foo({ "--Foo", "bar" }).$` yet.
 */
export function newSetCssVariableMethod(
  abbr: UtilityName,
  defs: Record<string, string>
): UtilityMethod {
  return `get ${abbr}() { return this${Object.entries(defs)
    .map(([prop, value]) => `.add("${prop}" as any, "${value}")`)
    .join("")}; }`;
}

// For any "increment" abbreviation, maps the abbreviation, i.e. "mt",
// to its longName or N other increment abbreviation that it composes.
export type IncConfig = [string, Prop | string[]];

/**
 * Makes [`mt0`, `mt1`, ...] utility methods for each configured increment.
 *
 * We assume that `prop` is a CSS property that accepts pixels as values, and
 * so convert each increment x (1, 2, 3) --> pixels Y (8, 16, 24) and create
 * a utility method for each x/Y pair.
 *
 * We also create a final param method, i.e. `mt(number)`, for callers that
 * need to call `mt` with a conditional amount of increments.
 *
 * TODO: Support non-pixel increments.
 *
 * @param abbr the utility prefix, i.e. `mt`
 * @param conf if a CSS prop, we assume "mt0 --> marginTop: 0px", otherwise if an array we delegate
 *   to other existing utility methods, i.e. `m0` -> `mx0.my0`.
 */
export function newIncrementMethods(
  config: Config,
  abbr: UtilityName,
  conf: Prop | string[]
): UtilityMethod[] {
  const delegateMethods = newIncrementDelegateMethods(config, abbr);
  if (Array.isArray(conf)) {
    return [
      ...delegateMethods,
      `${abbr}(inc: number | string) { return this.${conf
        .map((l) => `${l}(inc)`)
        .join(".")}; }`,
      `${abbr}Px(px: number) { return this.${conf
        .map((l) => `${l}Px(px)`)
        .join(".")}; }`,
    ];
  } else {
    return [
      ...delegateMethods,
      `${abbr}(inc: number | string) { return this.add("${conf}", maybeInc(inc)); }`,
      `${abbr}Px(px: number) { return this.add("${conf}", \`\${px}px\`); }`,
    ];
  }
}

/** Creates `<abbr>X` utility methods that call an `abbr(number)` that the caller is responsible for creating. */
export function newIncrementDelegateMethods(
  config: Config,
  abbr: UtilityName
): UtilityMethod[] {
  return zeroTo(config.numberOfIncrements).map(
    (i) => `get ${abbr}${i}() { return this.${abbr}(${i}); }`
  );
}

const zeroTo: (n: number) => number[] = (n) => [...Array(n + 1).keys()];

/** Keeps numbers as literals, and wraps anything else with double quotes. */
function maybeWrap(value: unknown): string {
  return typeof value === "number" ? String(value) : `"${value}"`;
}
