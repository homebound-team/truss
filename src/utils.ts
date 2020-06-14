import { Properties } from "csstype";
import { RuleConfig } from "rules";

export type Prop = keyof Properties;

export const zeroTo: (n: number) => number[] = (n) => [...Array(n + 1).keys()];

export function lowerCaseFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.substr(1);
}

/** Given a prop, and multiple abbreviations that map to the prop value, return methods for each abbreviation. */
export function makeRules<P extends Prop>(
  prop: P,
  defs: Record<string, Properties[P]>,
  methodName?: string
): string[] {
  return [
    ...Object.entries(defs).map(([abbr, value]) => {
      return `get ${abbr}() { return this.add("${prop}", "${value}"); }`;
    }),
    // Conditionally add a method that directly accepts a value for prop
    ...(methodName
      ? [
          `${methodName}(value: Properties["${prop}"]) { return this.add("${prop}", value); }`,
        ]
      : []),
  ];
}

/** Given a single abbreviation and multiple `prop` -> `value` pairs, returns a method that sets each pair. */
export function makeRule(abbr: string, defs: Properties): string {
  return `get ${abbr}() { return this${Object.entries(defs)
    .map(([prop, value]) => `.add("${prop}", "${value}")`)
    .join("")}; }`;
}

export function makeAliases(aliases: Record<string, string[]>): string[] {
  return Object.entries(aliases).map(([abbr, values]) => {
    return `get ${abbr}() { return this${values
      .map((v) => `.${v}`)
      .join("")}; }`;
  });
}

// For any "increment" abbreviation, maps the abbreviation, i.e. "mt",
// to its longName or N other increment abbreviation that it composes.
export type IncConfig = [string, Prop | string[]];

// If conf is a string[], we assume we're doing an alias like mx/my, and the conf entries are themselves mt/mb abbreviations
export function makeIncRules(
  config: RuleConfig,
  abbr: string,
  conf: Prop | string[]
): string[] {
  const incRules = zeroTo(config.numberOfIncrements).map(
    (i) => `get ${abbr}${i}() { return this.${abbr}(${i}); }`
  );
  if (Array.isArray(conf)) {
    return [
      ...incRules,
      `${abbr}(inc: number | string) { return this.${conf
        .map((l) => `${l}(inc)`)
        .join(".")}; }`,
    ];
  } else {
    return [
      ...incRules,
      `${abbr}(inc: number | string) { return this.add("${conf}", px(inc)); }`,
    ];
  }
}
