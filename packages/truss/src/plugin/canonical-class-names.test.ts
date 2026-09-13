import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { loadMapping } from "./index";
import { transformTruss } from "./transform";
import type { TrussMapping } from "./types";

const mappings: [string, TrussMapping][] = [
  ["app", loadMapping(resolve(__dirname, "../../../app/src/Css.json"))],
  ["template-tachyons", loadMapping(resolve(__dirname, "../../../template-tachyons/src/Css.json"))],
];

describe.each(mappings)("%s", (_name, mapping) => {
  it("names one declaration one class, however it is spelled", () => {
    // Given every static method that sets a single declaration, i.e. `mt2` or `pen`
    const statics = singleDeclarationStatics(mapping);
    expect(statics.length).toBeGreaterThan(100);
    // And the same declarations spelled through `add()`, and through the value method for the
    // property where the project has one, i.e. `mt(...)` and `pe(...)`
    const source = statics
      .flatMap((entry, i) => {
        const spellings = [`Css.${entry.abbr}.$`, `Css.add("${entry.prop}", ${entry.literal}).$`];
        if (entry.valueMethod) spellings.push(`Css.${entry.valueMethod}(${entry.literal}).$`);
        return spellings.map((spelling, j) => `const s${i}_${j} = ${spelling};`);
      })
      .join("\n");
    // When we transform them
    const code = transformTruss(`import { Css } from "./Css";\n${source}`, "test.tsx", mapping)?.code ?? "";
    const classNames = classNamesByConstant(code);
    // Then each spelling of a declaration lands on the same class as the static
    const disagreeing = statics.flatMap((entry, i) => {
      const [staticName, ...others] = [0, 1, 2].map((j) => classNames.get(`s${i}_${j}`)).filter((n) => n !== undefined);
      return others.every((name) => name === staticName)
        ? []
        : [`${entry.abbr}: ${[staticName, ...others].join(" vs ")}`];
    });
    expect(disagreeing).toEqual([]);
  });
});

/** The static methods that set exactly one declaration, with the value spelled as a TS literal. */
function singleDeclarationStatics(mapping: TrussMapping) {
  const valueMethods = new Map<string, string>();
  for (const [abbr, entry] of Object.entries(mapping.abbreviations)) {
    if (entry.kind === "variable" && entry.props.length === 1 && !entry.incremented) {
      valueMethods.set(entry.props[0], abbr);
    }
  }
  return Object.entries(mapping.abbreviations).flatMap(([abbr, entry]) => {
    if (entry.kind !== "static") return [];
    const defs = Object.entries(entry.defs ?? {});
    if (defs.length !== 1) return [];
    const [prop, value] = defs[0];
    // A value that is itself a custom property is left alone, i.e. `Css.setVar` territory.
    if (String(value).includes("var(--")) return [];
    return [{ abbr, prop, literal: JSON.stringify(String(value)), valueMethod: valueMethods.get(prop) }];
  });
}

/** I.e. `const s1_0 = { marginTop: "mt2" };` → `s1_0` → `mt2`. */
function classNamesByConstant(code: string): Map<string, string> {
  const flat = code.replace(/\s+/g, " ");
  const matches = flat.matchAll(/const (s\d+_\d+) = \{ [a-zA-Z]+: "([^"]+)" \}/g);
  return new Map([...matches].map((match) => [match[1], match[2]]));
}
