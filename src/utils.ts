import { Aliases, Config, UtilityMethod, UtilityName } from "./config";
import { Properties } from "csstype";

export type Prop = keyof Properties;

export const zeroTo: (n: number) => number[] = (n) => [...Array(n + 1).keys()];

export function lowerCaseFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.substr(1);
}

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
export function makeAliasesMethods(aliases: Aliases): UtilityMethod[] {
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

/** Turns a high-level `{ sm: 0, md: 200 }` breakpoint config into a useful set of multiple media queries. */
export function makeBreakpoints(
  breakpoints: Record<string, number>
): Record<string, string> {
  const r: Record<string, string> = {
    print: "@media print",
  };
  const bps = Object.keys(breakpoints);
  Object.entries(breakpoints).forEach(([bp, px], i) => {
    const isFirst = i === 0;
    const isLast = i === bps.length - 1;
    // Calc this breakpoint's min/max, which is its px --> the next bp's px - 1
    const min = !isFirst ? `${px}px` : "0";
    const max = !isLast ? `${breakpoints[bps[i + 1]] - 1}px` : "0";

    // Make a rule for exactly this breakpoint, i.e. "just sm" or "just md".
    if (isFirst) {
      // Don't bother with min-width on the smallest bp
      r[bp] = `@media screen and (max-width:${max})`;
    } else if (isLast) {
      // Don't bother with max-width on the largest bp
      r[bp] = `@media screen and (min-width:${min})`;
    } else {
      r[bp] = `@media screen and (min-width:${min}) and (max-width:${max})`;
    }

    // Make combinations of neighbors, i.e. smOrMd or mdOrLg. We could go further, like smOrMdOrLg, but that seems excessive.
    if (!isFirst) {
      const isSecond = i === 1;
      const prevBp = bps[i - 1];
      const name = `${prevBp}Or${capitalize(bp)}`;
      let rule = "@media screen";
      // If we're the `firstOrSecond` combination, we can skip min-width.
      if (!isSecond) {
        const prevMin = breakpoints[bps[i - 1]];
        rule += ` and (min-width:${prevMin}px)`;
      }
      // If we're the `secondToLastOrLast` combination, we can skip max-width.
      if (!isLast) {
        rule += ` and (max-width:${max})`;
      }
      r[name] = rule;
    }

    // Make up/down variants for any "middle" breakpoints, i.e. `smUp` is "everything" and
    // `smDown` is "just sm", so skip both of those, and same for largest `lgUp`/`lgDown` bp.
    if (!isFirst && !isLast) {
      r[`${bp}AndUp`] = `@media screen and (min-width:${min})`;
      r[`${bp}AndDown`] = `@media screen and (max-width:${max})`;
    }
  });
  return r;
}

/** Keeps numbers as literals, and wraps anything else with double quotes. */
function maybeWrap(value: unknown): string {
  return typeof value === "number" ? String(value) : `"${value}"`;
}

function capitalize(s: string): string {
  return `${s[0].toUpperCase()}${s.substring(1)}`;
}
