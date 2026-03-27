// @vitest-environment jsdom

import { afterEach, describe, expect, test } from "vitest";
import { toHaveStyle } from "./vitest";

expect.extend({ toHaveStyle });

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("toHaveStyle", () => {
  test("resolves whole-value CSS variables for computed styles in jsdom", () => {
    appendStyles(".color_var { color: var(--color); }");
    const el = document.createElement("div");
    el.className = "color_var";
    el.style.setProperty("--color", "blue");
    document.body.append(el);
    // jsdom exposes the unresolved `var(...)` for `color`, so the matcher
    // needs to follow the custom property to compare against the real value.
    expect(getComputedStyle(el).getPropertyValue("color")).toBe("var(--color)");
    expect(getComputedStyle(el).getPropertyValue("--color").trim()).toBe("blue");
    expect(el).toHaveStyle({ color: "blue" });
  });

  test("rejects custom property expectations", () => {
    const el = document.createElement("div");
    el.style.setProperty("--color", "blue");
    document.body.append(el);
    expect(() => expect(el).toHaveStyle({ "--color": "blue" })).toThrowError(
      "toHaveStyle does not support custom property expectations",
    );
  });

  test("treats rgb expected and rgba actual as equal", () => {
    appendStyles(".bg_var { background-color: var(--bg); }");
    const el = document.createElement("div");
    el.className = "bg_var";
    el.style.setProperty("--bg", "rgba(191, 219, 254, 1)");
    document.body.append(el);
    expect(getComputedStyle(el).getPropertyValue("background-color")).toBe("var(--bg)");
    expect(getComputedStyle(el).getPropertyValue("--bg").trim()).toBe("rgba(191, 219, 254, 1)");
    expect(el).toHaveStyle({ backgroundColor: "rgb(191, 219, 254)" });
  });

  test("treats rgba expected and rgb actual as equal", () => {
    appendStyles(".bg_var { background-color: var(--bg); }");
    const el = document.createElement("div");
    el.className = "bg_var";
    el.style.setProperty("--bg", "rgb(191, 219, 254)");
    document.body.append(el);
    expect(getComputedStyle(el).getPropertyValue("background-color")).toBe("var(--bg)");
    expect(getComputedStyle(el).getPropertyValue("--bg").trim()).toBe("rgb(191, 219, 254)");
    expect(el).toHaveStyle({ backgroundColor: "rgba(191, 219, 254, 1)" });
  });

  test("canonicalizes var-backed color values after resolving whole-value CSS variables", () => {
    appendStyles(".bg_var { background-color: var(--bg, rgba(191, 219, 254, 1)); }");
    const el = document.createElement("div");
    el.className = "bg_var";
    document.body.append(el);
    expect(getComputedStyle(el).getPropertyValue("background-color")).toBe("var(--bg, rgba(191, 219, 254, 1))");
    expect(el).toHaveStyle({ backgroundColor: "rgb(191, 219, 254)" });
  });

  test("still fails for non-equivalent colors", () => {
    const el = document.createElement("div");
    el.style.backgroundColor = "rgba(191, 219, 254, 1)";
    document.body.append(el);
    expect(() => expect(el).toHaveStyle({ backgroundColor: "rgb(190, 219, 254)" })).toThrowError(
      /background-color: expected rgb\(190, 219, 254\), received rgb\(191, 219, 254\)/,
    );
  });
});

function appendStyles(cssText: string): void {
  const style = document.createElement("style");
  style.textContent = cssText;
  document.head.append(style);
}
