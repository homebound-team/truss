import { describe, expect, it } from "vitest";
import { cssPropertyAbbreviations } from "./css-property-abbreviations";

describe("cssPropertyAbbreviations", () => {
  it("gives each property its own abbreviation", () => {
    // Given the hand-maintained table, which names a class when a value is folded
    const byAbbreviation = new Map<string, string[]>();
    for (const [property, abbreviation] of Object.entries(cssPropertyAbbreviations)) {
      byAbbreviation.set(abbreviation, [...(byAbbreviation.get(abbreviation) ?? []), property]);
    }
    // When we look for an abbreviation that two properties share
    const shared = [...byAbbreviation.entries()].filter(([, properties]) => properties.length > 1);
    // Then there are none, because two properties sharing one would put two declarations in one class
    expect(shared).toEqual([]);
  });

  it("keeps every abbreviation shorter than the property it stands for", () => {
    // Given the same table
    const entries = Object.entries(cssPropertyAbbreviations);
    // When we look for an abbreviation that is no shorter than its property name
    const notShorter = entries.filter(([property, abbreviation]) => abbreviation.length >= property.length);
    // Then there are none, because such an entry would only make its class names longer
    expect(notShorter).toEqual([]);
  });
});
