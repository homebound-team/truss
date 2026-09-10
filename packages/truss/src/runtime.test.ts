// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mergeProps, TrussDebugInfo, trussProps, __injectTrussCSS } from "./runtime";
import { mergeTrussCss } from "./plugin/merge-css";
import type { TestCssPayload } from "./test-css";

describe("trussProps", () => {
  test("merges static style hashes", () => {
    const result = trussProps({ display: "df", alignItems: "aic" }, { color: "black" });
    expect(result).toEqual({ className: "df aic black" });
  });

  test("last-write-wins for same property", () => {
    const result = trussProps({ display: "df" }, { display: "db" });
    expect(result).toEqual({ className: "db" });
  });

  test("handles space-separated class bundles", () => {
    const result = trussProps({ color: "black blue_h", display: "df" });
    expect(result).toEqual({ className: "black blue_h df" });
  });

  test("passes through custom className entries", () => {
    const result = trussProps({ className_custom: "custom", className_custom_2: "custom-2", display: "df" });
    expect(result).toEqual({ className: "custom custom-2 df" });
  });

  test("passes through custom inline style entries", () => {
    const result = trussProps({
      style_iconVars: { "--icon-primary": "red", "--icon-secondary": undefined },
      display: "df",
    });
    expect(result).toEqual({
      className: "df",
      style: { "--icon-primary": "red" },
    });
  });

  test("handles variable tuples with CSS variables", () => {
    const result = trussProps({ marginTop: ["mt_var", { "--marginTop": "16px" }] });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "16px" },
    });
  });

  test("handles variable tuples with multiple CSS variables", () => {
    const result = trussProps({
      borderColor: ["bc_var bc_var_h", { "--borderColor": "red", "--h_borderColor": "blue" }],
    });
    expect(result).toEqual({
      className: "bc_var bc_var_h",
      style: { "--borderColor": "red", "--h_borderColor": "blue" },
    });
  });

  test("later custom inline styles override earlier variable tuple values", () => {
    const result = trussProps({
      marginTop: ["mt_var", { "--marginTop": "16px" }],
      style_iconVars: { "--marginTop": "24px" },
    });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "24px" },
    });
  });

  test("later variable tuple values override earlier custom inline styles", () => {
    const result = trussProps({
      style_iconVars: { "--marginTop": "24px" },
      marginTop: ["mt_var", { "--marginTop": "16px" }],
    });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "16px" },
    });
  });

  test("override replaces entire property bundle including pseudo classes", () => {
    const result = trussProps({ color: "black blue_h" }, { color: "white" });
    expect(result).toEqual({ className: "white" });
  });

  test("filters falsy values", () => {
    const result = trussProps({ display: "df" }, false, null, undefined, { color: "black" });
    expect(result).toEqual({ className: "df black" });
  });

  test("does not emit data-truss-src in Vitest", () => {
    const result = trussProps({
      display: ["df", new TrussDebugInfo("MyComponent.tsx:5")],
      color: "black",
    });
    expect(result).toEqual({
      className: "df black",
    });
  });

  test("still emits data-truss-src outside Vitest", async () => {
    const previousVitest = process.env.VITEST;

    delete process.env.VITEST;

    try {
      vi.resetModules();
      const runtime = await import("./runtime");
      const result = runtime.trussProps({
        display: ["df", new runtime.TrussDebugInfo("MyComponent.tsx:5")],
        color: "black",
      });

      expect(result).toEqual({
        className: "df black",
        "data-truss-src": "MyComponent.tsx:5",
      });
    } finally {
      if (previousVitest === undefined) {
        delete process.env.VITEST;
      } else {
        process.env.VITEST = previousVitest;
      }
      vi.resetModules();
    }
  });

  test("omits deduplicated debug sources in Vitest", () => {
    const result = trussProps(
      { display: ["df", new TrussDebugInfo("A.tsx:1")] },
      { color: ["black", new TrussDebugInfo("A.tsx:1")] },
    );
    expect(result).toEqual({
      className: "df black",
    });
  });

  test("handles variable tuple with debug info in Vitest without data-truss-src", () => {
    const result = trussProps({
      marginTop: ["mt_var", { "--marginTop": "16px" }, new TrussDebugInfo("File.tsx:3")],
    });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "16px" },
    });
  });

  test("returns empty className for no inputs", () => {
    const result = trussProps();
    expect(result).toEqual({ className: "" });
  });

  test("throws for plain object values that are not Truss tuples", () => {
    expect(() => {
      trussProps({ color: { bad: true } as unknown as "black" });
    }).toThrowError(
      "Invalid Truss style value for `color`. trussProps only accepts generated Truss style hashes; use mergeProps for explicit className/style merging.",
    );
  });

  test("throws for tuple values with invalid payloads", () => {
    expect(() => {
      trussProps({ color: ["black", 123] as unknown as "black" });
    }).toThrowError(
      "Invalid Truss style value for `color`. trussProps only accepts generated Truss style hashes; use mergeProps for explicit className/style merging.",
    );
  });

  test("skips validation in production mode", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      vi.resetModules();
      const runtime = await import("./runtime");
      const result = runtime.trussProps({ color: { bad: true } as unknown as "black" });
      expect(result).toEqual({ className: "" });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      vi.resetModules();
    }
  });
});

describe("mergeProps", () => {
  test("prepends explicit className", () => {
    const result = mergeProps("existing", undefined, { display: "df" });
    expect(result).toEqual({ className: "existing df" });
  });

  test("merges explicit style with CSS variables", () => {
    const result = mergeProps(
      undefined,
      { color: "red" },
      {
        marginTop: ["mt_var", { "--marginTop": "16px" }],
      },
    );
    expect(result).toEqual({
      className: "mt_var",
      style: { color: "red", "--marginTop": "16px" },
    });
  });

  test("CSS variables override explicit style keys if they collide", () => {
    // CSS variables (from Truss) should take precedence over explicit style
    const result = mergeProps(undefined, { "--marginTop": "8px" } as Record<string, unknown>, {
      marginTop: ["mt_var", { "--marginTop": "16px" }],
    });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "16px" },
    });
  });

  test("handles both explicit className and style together", () => {
    const result = mergeProps("myClass", { fontSize: "14px" }, { display: "df", color: "black" });
    expect(result).toEqual({
      className: "myClass df black",
      style: { fontSize: "14px" },
    });
  });

  test("omits debug info in Vitest", () => {
    const result = mergeProps("existing", undefined, {
      display: ["df", new TrussDebugInfo("X.tsx:1")],
    });
    expect(result).toEqual({
      className: "existing df",
    });
  });
});

describe("__injectTrussCSS", () => {
  beforeEach(removeTrussStyles);
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    removeTrussStyles();
  });

  test.each(["original", "reversed", "shuffled", "bootstrap subset"])(
    "matches production CSSOM for %s structured input after JSON roundtrip",
    (order) => {
      const payloads = [
        atomicPayload(4000, "top", ".top { margin-top: 12px; }"),
        atomicPayload(1000, "margin", ".margin { margin: 4px; }"),
        atomicPayload(
          3200,
          "zMin600",
          "@media (min-width: 600px) { .zMin600 { color: red; } }",
          "@media (min-width: 600px)",
        ),
        atomicPayload(
          3200,
          "aMin960",
          "@media (min-width: 960px) { .aMin960 { color: blue; } }",
          "@media (min-width: 960px)",
        ),
        atomicPayload(
          3200,
          "zMax1150",
          "@media (max-width: 1150px) { .zMax1150 { color: green; } }",
          "@media (max-width: 1150px)",
        ),
        atomicPayload(
          3200,
          "aMax820",
          "@media (max-width: 820px) { .aMax820 { color: black; } }",
          "@media (max-width: 820px)",
        ),
        atomicPayload(
          3200,
          "range",
          "@media (min-width: 600px) and (max-width: 959px) { .range { color: gray; } }",
          "@media (min-width: 600px) and (max-width: 959px)",
        ),
        atomicPayload(3200, "print", "@media print { .print { color: purple; } }", "@media print"),
        atomicPayload(
          3200,
          "bMin600",
          "@media (min-width: 600px) { .bMin600 { color: yellow; } }",
          "@media (min-width: 600px)",
        ),
      ];
      const expected = productionRules(payloads);
      const indices =
        order === "reversed"
          ? [8, 7, 6, 5, 4, 3, 2, 1, 0]
          : order === "shuffled"
            ? [5, 0, 8, 3, 1, 7, 4, 2, 6]
            : [0, 1, 2, 3, 4, 5, 6, 7, 8];
      if (order === "bootstrap subset") {
        __injectTrussCSS({ rules: [...payloads[0].rules!, ...payloads[4].rules!] });
      }
      for (const index of indices) __injectTrussCSS(JSON.parse(JSON.stringify(payloads[index])));

      // Media evaluation is not supported by jsdom; compare its parsed rules instead.
      expect(sheetRules(trussStyle().sheet!)).toEqual(expected);
      expect(document.querySelectorAll("style[data-truss]").length).toBe(1);
      expect(document.styleSheets.length).toBe(1);
      expect(trussStyle().textContent).toBe("");
    },
  );

  test("parses only new atomics and retains earlier CSSRule identities when inserting before them", () => {
    const top = atomicPayload(4000, "top", ".top { margin-top: 12px; }");
    const margin = atomicPayload(1000, "margin", ".margin { margin: 4px; }");
    __injectTrussCSS(top);
    const style = trussStyle();
    const sheet = style.sheet!;
    const firstRule = sheet.cssRules[0];
    const insert = vi.spyOn(sheet, "insertRule");

    __injectTrussCSS({ rules: [...top.rules!.map((rule) => ({ ...rule })), ...margin.rules!] });
    expect(insert.mock.calls).toEqual([[".margin { margin: 4px; }", 0]]);
    expect(trussStyle()).toBe(style);
    expect(style.sheet).toBe(sheet);
    expect(sheet.cssRules[1]).toBe(firstRule);
    expect(sheetRules(sheet)).toEqual(productionRules([top, margin]));
  });

  test("invalidates computed styles after late rules without replacing the sheet", () => {
    const top = atomicPayload(4000, "top", ".top { margin-top: 12px; }");
    const margin = atomicPayload(1000, "margin", ".margin { margin: 4px; }");
    const color = atomicPayload(3000, "color", ".color { color: red; }");
    __injectTrussCSS(top);
    const style = trussStyle();
    const sheet = style.sheet;
    const attribute = vi.spyOn(style, "setAttribute");
    const target = document.createElement("div");
    target.className = "top margin color";
    document.body.appendChild(target);
    try {
      expect(getComputedStyle(target).marginTop).toBe("12px");
      expect(getComputedStyle(target).marginRight).toBe("0px");
      const previousColor = getComputedStyle(target).color;
      __injectTrussCSS({ rules: [...margin.rules!, ...color.rules!] });
      expect(attribute.mock.calls).toEqual([["data-truss", ""]]);
      expect(style.sheet).toBe(sheet);
      expect(getComputedStyle(target).marginTop).toBe("12px");
      expect(getComputedStyle(target).marginRight).toBe("4px");
      expect(getComputedStyle(target).color).not.toBe(previousColor);
      expect(getComputedStyle(target).color).toBe("rgb(255, 0, 0)");
    } finally {
      target.remove();
    }
  });

  test("deduplicates copied payloads across runtime reloads on the same anchor", async () => {
    const payload = atomicPayload(3000, "df", ".df { display: flex; }");
    __injectTrussCSS(payload);
    const style = trussStyle();
    const sheet = style.sheet!;
    const rule = sheet.cssRules[0];
    const insert = vi.spyOn(sheet, "insertRule");
    const attribute = vi.spyOn(style, "setAttribute");
    __injectTrussCSS(JSON.parse(JSON.stringify(payload)));
    vi.resetModules();
    const runtime = await import("./runtime");
    runtime.__injectTrussCSS(JSON.parse(JSON.stringify(payload)));

    expect(insert.mock.calls).toEqual([]);
    expect(attribute.mock.calls).toEqual([]);
    expect(trussStyle()).toBe(style);
    expect(style.sheet).toBe(sheet);
    expect(sheet.cssRules[0]).toBe(rule);
    expect(sheetRules(sheet)).toEqual(productionRules([payload]));
    expect(document.querySelectorAll("style[data-truss]").length).toBe(1);
    runtime.__injectTrussCSS(atomicPayload(1000, "aic", ".aic { align-items: center; }"));
    expect(sheet.cssRules[1]).toBe(rule);
  });

  test("ignores empty CSS", () => {
    __injectTrussCSS({});
    expect(document.querySelectorAll("style").length).toBe(0);
  });

  test("ignores CSS when there is no document", () => {
    const css = atomicPayload(3000, "df", ".df { display: flex; }");
    vi.stubGlobal("document", undefined);
    try {
      expect(() => __injectTrussCSS(css)).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(document.querySelectorAll("style").length).toBe(0);
    __injectTrussCSS(css);
    expect(sheetRules(trussStyle().sheet!)).toEqual(productionRules([css]));
  });

  test.each(["app first", "library first"])("uses the lower-order library class definition: %s", (order) => {
    const app = atomicPayload(4000, "target", ".target { color: blue; }");
    const library = { ...atomicPayload(1000, "target", ".target { color: red; }"), order: 0 };
    const other = atomicPayload(3000, "other", ".other { display: flex; }");
    __injectTrussCSS(other);
    const sheet = trussStyle().sheet!;
    const otherRule = sheet.cssRules[0];
    if (order === "app first") __injectTrussCSS({ ...app, source: "/app.ts" });
    __injectTrussCSS(library);
    const libraryRule = sheet.cssRules[0];
    const insert = vi.spyOn(sheet, "insertRule");
    __injectTrussCSS({ ...app, source: "/late-app.ts", order: 1 });
    expect(insert.mock.calls).toEqual([]);
    expect(sheetRules(sheet)).toEqual(productionRules([library, app, other]));
    expect(sheet.cssRules[0]).toBe(libraryRule);
    expect(sheet.cssRules[1]).toBe(otherRule);
  });

  test("orders arbitrary library CSS before canonical app sources and preserves opaque block order and duplicates", () => {
    const duplicate = ".duplicate { color: red; }";
    const appA: TestCssPayload = {
      source: "/app/A.css.ts",
      arbitraryRules: [
        duplicate,
        "@media (min-width: 600px) { @supports (display: grid) { .nested { display: grid; } } }",
        duplicate,
      ],
    };
    const appZ: TestCssPayload = { source: "/app/Z.css.ts", arbitraryRules: [duplicate] };
    const libraries: TestCssPayload = {
      source: "libraries",
      order: 0,
      arbitraryRules: [".libraryB { color: blue; }", ".libraryA { color: green; }"],
    };
    const atomic = atomicPayload(3000, "df", ".df { display: flex; }");
    __injectTrussCSS(appZ);
    const sheet = trussStyle().sheet!;
    const appZRule = sheet.cssRules[0];
    __injectTrussCSS(libraries);
    __injectTrussCSS(appA);
    __injectTrussCSS(atomic);

    expect(sheetRules(sheet)).toEqual(productionRules([atomic, libraries, appA, appZ]));
    expect(sheet.cssRules.length).toBe(7);
    expect(sheet.cssRules[6]).toBe(appZRule);
    const insert = vi.spyOn(sheet, "insertRule");
    __injectTrussCSS(JSON.parse(JSON.stringify(appA)));
    expect(insert.mock.calls).toEqual([]);
  });

  test("inserts arbitrary top-level rules once without temporary parser elements or text writes", () => {
    const atomic = atomicPayload(3000, "df", ".df { display: flex; }");
    const payload: TestCssPayload = {
      source: "/nested.css.ts",
      arbitraryRules: [
        "@media (min-width: 600px) { @supports (display: grid) { .nested { display: grid; } } }",
        ".target { color: red; }",
      ],
    };
    const expected = productionRules([atomic, payload]);
    __injectTrussCSS(atomic);
    const sheet = trussStyle().sheet!;
    const earlierRule = sheet.cssRules[0];
    const createElement = vi.spyOn(document, "createElement");
    const textContent = vi.spyOn(Node.prototype, "textContent", "set");
    const insert = vi.spyOn(sheet, "insertRule");

    __injectTrussCSS(payload);
    __injectTrussCSS(JSON.parse(JSON.stringify(payload)));

    expect(createElement.mock.calls).toEqual([]);
    expect(textContent.mock.calls).toEqual([]);
    expect(insert.mock.calls).toEqual([
      [payload.arbitraryRules![0], 1],
      [payload.arbitraryRules![1], 2],
    ]);
    expect(sheet.cssRules[0]).toBe(earlierRule);
    expect(sheetRules(sheet)).toEqual(expected);
  });

  test("skips unsupported arbitrary at-rules without shifting subsequent positions", () => {
    const first = atomicPayload(3000, "df", ".df { display: flex; }");
    const payload: TestCssPayload = {
      source: "/unsupported.css.ts",
      arbitraryRules: [
        "@property --gap { syntax: '<length>'; inherits: false; initial-value: 0px; }",
        ".before { color: red; }",
        "@unknown-truss-rule foo { arbitrary tokens; }",
        ".after { color: blue; }",
      ],
    };
    __injectTrussCSS(first);
    const sheet = trussStyle().sheet!;
    const earlierRule = sheet.cssRules[0];
    const insert = vi.spyOn(sheet, "insertRule");

    expect(() => __injectTrussCSS(payload)).not.toThrow();
    expect(insert.mock.calls).toEqual([
      [payload.arbitraryRules![0], 1],
      [payload.arbitraryRules![1], 1],
      [payload.arbitraryRules![2], 2],
      [payload.arbitraryRules![3], 2],
    ]);
    insert.mockClear();
    __injectTrussCSS(JSON.parse(JSON.stringify(payload)));
    expect(insert.mock.calls).toEqual([]);
    const later = atomicPayload(1000, "margin", ".margin { margin: 4px; }");
    __injectTrussCSS(later);
    expect(insert.mock.calls).toEqual([[".margin { margin: 4px; }", 0]]);
    expect(sheet.cssRules[1]).toBe(earlierRule);
    expect(sheetRules(sheet)).toEqual(
      productionRules([
        first,
        later,
        {
          ...payload,
          arbitraryRules: [payload.arbitraryRules![1], payload.arbitraryRules![3]],
        },
      ]),
    );
  });

  test("deduplicates properties by variable name and replaces higher-order definitions", () => {
    const first = atomicPayload(3000, "df", ".df { display: flex; }");
    const app: TestCssPayload = {
      properties: [
        { varName: "--gap", cssText: "@property --gap { syntax: '<length>'; inherits: false; initial-value: 4px; }" },
      ],
    };
    const library: TestCssPayload = {
      order: 0,
      properties: [
        { varName: "--gap", cssText: "@property --gap { syntax: '<length>'; inherits: false; initial-value: 8px; }" },
      ],
    };
    __injectTrussCSS(first);
    const sheet = trussStyle().sheet!;
    const earlierRule = sheet.cssRules[0];
    const nativeInsert = sheet.insertRule.bind(sheet);
    // jsdom does not support @property; use a supported rule to exercise successful registration.
    const insert = vi
      .spyOn(sheet, "insertRule")
      .mockImplementation((cssText, index) =>
        nativeInsert(cssText === app.properties![0].cssText ? ":root { --gap: 4px; }" : ":root { --gap: 8px; }", index),
      );
    __injectTrussCSS(app);
    __injectTrussCSS(JSON.parse(JSON.stringify(app)));
    __injectTrussCSS(library);
    __injectTrussCSS(JSON.parse(JSON.stringify(library)));
    __injectTrussCSS(app);
    expect(insert.mock.calls).toEqual([
      [app.properties![0].cssText, 1],
      [library.properties![0].cssText, 1],
    ]);
    expect(sheet.cssRules[0]).toBe(earlierRule);
    expect(sheetRules(sheet)).toEqual([".df { display: flex; }", ":root { --gap: 8px; }"]);
  });

  test("retains the prelude from an empty bootstrap before all later rules", () => {
    const prelude = ":root { --truss-ready: 1; }";
    __injectTrussCSS({ prelude });
    const sheet = trussStyle().sheet!;
    const preludeRule = sheet.cssRules[0];
    const atomic = atomicPayload(1000, "df", ".df { display: flex; }");
    __injectTrussCSS(atomic);
    __injectTrussCSS({ prelude });
    expect(sheetRules(sheet)).toEqual([...parseCssRules(prelude), ...productionRules([atomic])]);
    expect(sheet.cssRules[0]).toBe(preludeRule);
  });

  test("skips unsupported @property without losing surrounding or later rules", () => {
    const first = atomicPayload(3000, "df", ".df { display: flex; }");
    const property: TestCssPayload = {
      properties: [
        { varName: "--gap", cssText: "@property --gap { syntax: '<length>'; inherits: false; initial-value: 0px; }" },
      ],
    };
    const arbitrary: TestCssPayload = { source: "/target.css.ts", arbitraryRules: [".target { color: red; }"] };
    const later = atomicPayload(1000, "margin", ".margin { margin: 4px; }");
    __injectTrussCSS(first);
    const sheet = trussStyle().sheet!;
    const rule = sheet.cssRules[0];
    // jsdom rejects @property through insertRule but skips it when parsing style text.
    expect(() => sheet.insertRule(property.properties![0].cssText, 0)).toThrowError(DOMException);
    const insert = vi.spyOn(sheet, "insertRule");
    expect(() => __injectTrussCSS({ ...first, ...property, ...arbitrary })).not.toThrow();
    expect(insert.mock.calls).toEqual([
      [property.properties![0].cssText, 1],
      [".target { color: red; }", 1],
    ]);
    insert.mockClear();
    const attribute = vi.spyOn(trussStyle(), "setAttribute");
    __injectTrussCSS(JSON.parse(JSON.stringify({ ...first, ...property, ...arbitrary })));
    expect(insert.mock.calls).toEqual([]);
    expect(attribute.mock.calls).toEqual([]);
    __injectTrussCSS(later);
    expect(sheetRules(sheet)).toEqual(productionRules([first, property, arbitrary, later]));
    expect(sheet.cssRules[1]).toBe(rule);
  });

  test("propagates invalid atomic errors and retries copied payloads without duplicating installed rules", () => {
    const first = atomicPayload(3000, "df", ".df { display: flex; }");
    const installed = atomicPayload(3500, "installed", ".installed { color: green; }");
    const invalid = atomicPayload(4000, "invalid", "not a CSS rule");
    const last = atomicPayload(5000, "last", ".last { color: red; }");
    __injectTrussCSS(first);
    const sheet = trussStyle().sheet!;
    const rule = sheet.cssRules[0];
    const insert = vi.spyOn(sheet, "insertRule");
    const attribute = vi.spyOn(trussStyle(), "setAttribute");
    const payload = { rules: [...first.rules!, ...installed.rules!, ...invalid.rules!, ...last.rules!] };
    expect(() => __injectTrussCSS(payload)).toThrow();
    expect(attribute.mock.calls).toEqual([["data-truss", ""]]);
    attribute.mockClear();
    expect(() => __injectTrussCSS(JSON.parse(JSON.stringify(payload)))).toThrow();
    expect(attribute.mock.calls).toEqual([]);
    expect(insert.mock.calls).toEqual([
      [".installed { color: green; }", 1],
      ["not a CSS rule", 2],
      ["not a CSS rule", 2],
    ]);
    expect(sheetRules(sheet)).toEqual(productionRules([first, installed]));
    const corrected = atomicPayload(4000, "invalid", ".invalid { color: blue; }");
    __injectTrussCSS({ rules: [...first.rules!, ...installed.rules!, ...corrected.rules!, ...last.rules!] });
    expect(sheetRules(sheet)).toEqual(productionRules([first, installed, corrected, last]));
    expect(sheet.cssRules[0]).toBe(rule);
  });

  test.each([false, true])("resets the registry after removal with reattach=%s", (reattach) => {
    const first = atomicPayload(3000, "df", ".df { display: flex; }");
    const second = atomicPayload(4000, "aic", ".aic { align-items: center; }");
    __injectTrussCSS({ rules: [...first.rules!, ...second.rules!] });
    const style = trussStyle();
    const sheet = style.sheet;
    style.remove();
    if (reattach) document.head.appendChild(style);
    __injectTrussCSS(first);
    expect(trussStyle() === style).toBe(reattach);
    expect(trussStyle().sheet).not.toBe(sheet);
    expect(sheetRules(trussStyle().sheet!)).toEqual(productionRules([first]));
    __injectTrussCSS({ rules: [...first.rules!, ...second.rules!] });
    expect(sheetRules(trussStyle().sheet!)).toEqual(productionRules([first, second]));
  });

  test("recovers in a replacement document and reuses the original document registry on return", () => {
    const css = atomicPayload(3000, "df", ".df { display: flex; }");
    const expected = productionRules([css]);
    __injectTrussCSS(css);
    const original = trussStyle();
    const originalRule = original.sheet!.cssRules[0];
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const replacement = frame.contentDocument!;
    vi.stubGlobal("document", replacement);
    try {
      __injectTrussCSS(css);
      expect(trussStyle()).not.toBe(original);
      expect(trussStyle().ownerDocument).toBe(replacement);
      expect(sheetRules(trussStyle().sheet!)).toEqual(expected);
      expect(replacement.querySelectorAll("style[data-truss]").length).toBe(1);
    } finally {
      vi.unstubAllGlobals();
      frame.remove();
    }
    __injectTrussCSS(css);
    expect(trussStyle()).toBe(original);
    expect(original.sheet!.cssRules[0]).toBe(originalRule);
    expect(sheetRules(original.sheet!)).toEqual(expected);
  });
});

/** Supply one atomic rule with its production priority, class identity, and explicit query. */
function atomicPayload(priority: number, className: string, cssText: string, atRule?: string): TestCssPayload {
  return { rules: [{ priority, className, cssText, atRule }] };
}

/** Merge canonical production sources and parse their expected CSSOM in a separate document. */
function productionRules(sources: TestCssPayload[]): string[] {
  return parseCssRules(
    mergeTrussCss(
      sources.map((source) => ({
        rules: source.rules ?? [],
        properties: source.properties ?? [],
        arbitraryCssBlocks: source.arbitraryRules?.length ? [{ cssText: source.arbitraryRules.join("\n") }] : [],
      })),
    ),
  );
}

/** Parse stylesheet text without adding expected rules to the document under test. */
function parseCssRules(cssText: string): string[] {
  // createHTMLDocument has no browsing context, so jsdom does not create its stylesheets.
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  try {
    const parserDocument = frame.contentDocument!;
    const style = parserDocument.createElement("style");
    parserDocument.head.appendChild(style);
    style.textContent = cssText;
    return sheetRules(style.sheet!);
  } finally {
    frame.remove();
  }
}

/** Return the complete ordered CSSOM text, including nested at-rules. */
function sheetRules(sheet: CSSStyleSheet): string[] {
  return Array.from(sheet.cssRules, (rule) => rule.cssText);
}

/** Find the single runtime injection anchor. */
function trussStyle(): HTMLStyleElement {
  return document.querySelector<HTMLStyleElement>("style[data-truss]")!;
}

/** Remove the static stylesheet and its registry between tests. */
function removeTrussStyles(): void {
  document.querySelectorAll("style[data-truss]").forEach((el) => el.remove());
}
