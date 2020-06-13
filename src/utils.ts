import { CSSProperties } from "react";

export type Prop = keyof CSSProperties;

export const zeroTo: (n: number) => number[] = n => [...Array(n + 1).keys()];

export function lowerCaseFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.substr(1);
}

/** Given a prop, and a mapping of `abbr` -> `value`, return a getter. */
export function makeRules(prop: Prop, defs: [string, string][], methodName?: string): string[] {
  return [
    ...defs.map(([abbr, value]) => {
      return `get ${abbr}() { return this.add("${prop}", "${value}"); }`;
    }),
    // Conditionally add a method that accepts a value
    ...(methodName ? [`${methodName}(value: Properties["${prop}"]) { return this.add("${prop}", value); }`] : []),
  ];
}

export function makeAliases(aliases: Record<string, string[]>): string[] {
  return Object.entries(aliases).map(([abbr, values]) => {
    return `get ${abbr}() { return this${values.map(v => `.${v}`).join("")}; }`;
  });
}
