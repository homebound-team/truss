import { describe, expect, test } from "vitest";
import { incrementCssValue, maybeCssVar, tryParseIncrementCalcMultiplier } from "./spacing-css-var";

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

describe("maybeCssVar", () => {
  test("wraps custom property names", () => {
    expect(maybeCssVar("--theme-accent")).toBe("var(--theme-accent)");
  });

  test("passes through normal values", () => {
    expect(maybeCssVar("red")).toBe("red");
    expect(maybeCssVar("16px")).toBe("16px");
  });

  test("does not double-wrap var()", () => {
    expect(maybeCssVar("var(--theme-accent)")).toBe("var(--theme-accent)");
  });

  test("passes through non-strings", () => {
    expect(maybeCssVar(42)).toBe(42);
  });
});
