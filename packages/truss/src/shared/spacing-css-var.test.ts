import { describe, expect, test } from "vitest";
import { incrementCssValue, maybeInc, tryParseIncrementCalcMultiplier } from "./spacing-css-var";

describe("tryParseIncrementCalcMultiplier", () => {
  test("parses positive, zero, negative integers", () => {
    expect(tryParseIncrementCalcMultiplier(incrementCssValue(2))).toBe("2");
    expect(tryParseIncrementCalcMultiplier(incrementCssValue(0))).toBe("0");
    expect(tryParseIncrementCalcMultiplier(incrementCssValue(-1))).toBe("-1");
  });

  test("parses decimals", () => {
    expect(tryParseIncrementCalcMultiplier(incrementCssValue(2.5))).toBe("2.5");
    expect(tryParseIncrementCalcMultiplier(incrementCssValue(-0.25))).toBe("-0.25");
  });

  test("returns null for other values", () => {
    expect(tryParseIncrementCalcMultiplier("16px")).toBe(null);
    expect(tryParseIncrementCalcMultiplier("calc(var(--other) * 2)")).toBe(null);
  });
});

describe("maybeInc", () => {
  test("treats a number as a count of increments", () => {
    // Given a number of increments
    // When we resolve it
    const result = maybeInc(2);
    // Then it is a multiple of the spacing variable
    expect(result).toEqual("calc(var(--t-spacing) * 2)");
  });

  test("uses a string as-is", () => {
    // Given a value that already has a unit
    // When we resolve it
    const result = maybeInc("4px");
    // Then it is unchanged
    expect(result).toEqual("4px");
  });
});
