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
    const style = document.createElement("style");
    style.textContent = ".color_var { color: var(--color); }";
    document.head.append(style);

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
});
