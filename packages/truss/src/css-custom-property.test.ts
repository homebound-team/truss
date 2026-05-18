import { describe, expect, test } from "vitest";
import { maybeCssVar, variableValueNeedsMaybeCssVar } from "./css-custom-property";

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

describe("variableValueNeedsMaybeCssVar", () => {
  test("returns false for Px delegates", () => {
    expect(variableValueNeedsMaybeCssVar({ appendPx: true })).toBe(false);
  });

  test("returns true for increment and open param segments", () => {
    expect(variableValueNeedsMaybeCssVar({})).toBe(true);
    expect(variableValueNeedsMaybeCssVar({ appendPx: false })).toBe(true);
  });
});
