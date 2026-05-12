import { describe, expect, test } from "vitest";
import { trussWebIncrementCssValue, trussWebTryParseIncrementCalcMultiplier } from "./spacing-css-var";

describe("trussWebTryParseIncrementCalcMultiplier", () => {
  test("parses positive, zero, negative integers", () => {
    expect(trussWebTryParseIncrementCalcMultiplier(trussWebIncrementCssValue(2))).toBe("2");
    expect(trussWebTryParseIncrementCalcMultiplier(trussWebIncrementCssValue(0))).toBe("0");
    expect(trussWebTryParseIncrementCalcMultiplier(trussWebIncrementCssValue(-1))).toBe("-1");
  });

  test("parses decimals", () => {
    expect(trussWebTryParseIncrementCalcMultiplier(trussWebIncrementCssValue(2.5))).toBe("2.5");
    expect(trussWebTryParseIncrementCalcMultiplier(trussWebIncrementCssValue(-0.25))).toBe("-0.25");
  });

  test("returns null for other values", () => {
    expect(trussWebTryParseIncrementCalcMultiplier("16px")).toBe(null);
    expect(trussWebTryParseIncrementCalcMultiplier("calc(var(--other) * 2)")).toBe(null);
  });
});
