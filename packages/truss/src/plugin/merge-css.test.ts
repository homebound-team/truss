import { describe, expect, test } from "vitest";
import { parseTrussCss, mergeTrussCss, type ParsedTrussCss } from "./merge-css";

describe("parseTrussCss", () => {
  test("parses rules with priority annotations", () => {
    const css = [
      "/* @truss p:3000 c:df */",
      ".df { display: flex; }",
      "/* @truss p:3000 c:black */",
      ".black { color: #353535; }",
    ].join("\n");

    const result = parseTrussCss(css);
    expect(result.rules).toEqual([
      { priority: 3000, className: "df", cssText: ".df { display: flex; }" },
      { priority: 3000, className: "black", cssText: ".black { color: #353535; }" },
    ]);
    expect(result.properties).toEqual([]);
  });

  test("parses @property declarations", () => {
    const css = [
      "/* @truss p:4000.5 c:mt_var */",
      ".mt_var { margin-top: var(--marginTop); }",
      "/* @truss @property */",
      '@property --marginTop { syntax: "*"; inherits: false; }',
    ].join("\n");

    const result = parseTrussCss(css);
    expect(result.rules).toEqual([
      { priority: 4000.5, className: "mt_var", cssText: ".mt_var { margin-top: var(--marginTop); }" },
    ]);
    expect(result.properties).toEqual([
      { cssText: '@property --marginTop { syntax: "*"; inherits: false; }', varName: "--marginTop" },
    ]);
  });

  test("parses fractional priorities", () => {
    const css = ["/* @truss p:3000.5 c:w_var */", ".w_var { width: var(--width); }"].join("\n");

    const result = parseTrussCss(css);
    expect(result.rules[0].priority).toBe(3000.5);
  });

  test("handles empty input", () => {
    const result = parseTrussCss("");
    expect(result.rules).toEqual([]);
    expect(result.properties).toEqual([]);
  });

  test("ignores lines without annotations", () => {
    const css = [
      "/* some other comment */",
      ".random { color: red; }",
      "/* @truss p:3000 c:df */",
      ".df { display: flex; }",
    ].join("\n");

    const result = parseTrussCss(css);
    expect(result.rules).toEqual([{ priority: 3000, className: "df", cssText: ".df { display: flex; }" }]);
  });

  test("parses media query rules", () => {
    const css = [
      "/* @truss p:3200 c:sm_blue */",
      "@media screen and (max-width: 599px) { .sm_blue.sm_blue { color: #526675; } }",
    ].join("\n");

    const result = parseTrussCss(css);
    expect(result.rules).toEqual([
      {
        priority: 3200,
        className: "sm_blue",
        cssText: "@media screen and (max-width: 599px) { .sm_blue.sm_blue { color: #526675; } }",
      },
    ]);
  });

  test("parses multiple @property declarations", () => {
    const css = [
      "/* @truss p:4000.5 c:sq_var */",
      ".sq_var { height: var(--height); width: var(--width); }",
      "/* @truss @property */",
      '@property --height { syntax: "*"; inherits: false; }',
      "/* @truss @property */",
      '@property --width { syntax: "*"; inherits: false; }',
    ].join("\n");

    const result = parseTrussCss(css);
    expect(result.properties).toEqual([
      { cssText: '@property --height { syntax: "*"; inherits: false; }', varName: "--height" },
      { cssText: '@property --width { syntax: "*"; inherits: false; }', varName: "--width" },
    ]);
  });
});

describe("mergeTrussCss", () => {
  test("merges two sources with no overlap", () => {
    const source1: ParsedTrussCss = {
      rules: [{ priority: 3000, className: "df", cssText: ".df { display: flex; }" }],
      properties: [],
    };
    const source2: ParsedTrussCss = {
      rules: [{ priority: 3000, className: "black", cssText: ".black { color: #353535; }" }],
      properties: [],
    };

    const merged = mergeTrussCss([source1, source2]);
    // Both rules present, alphabetical tiebreak: black before df
    expect(merged).toContain(".black { color: #353535; }");
    expect(merged).toContain(".df { display: flex; }");
    const blackIdx = merged.indexOf(".black {");
    const dfIdx = merged.indexOf(".df {");
    expect(blackIdx).toBeLessThan(dfIdx);
  });

  test("deduplicates rules by class name", () => {
    const source1: ParsedTrussCss = {
      rules: [
        { priority: 3000, className: "df", cssText: ".df { display: flex; }" },
        { priority: 3000, className: "black", cssText: ".black { color: #353535; }" },
      ],
      properties: [],
    };
    const source2: ParsedTrussCss = {
      rules: [
        { priority: 3000, className: "df", cssText: ".df { display: flex; }" },
        { priority: 3000, className: "blue", cssText: ".blue { color: #526675; }" },
      ],
      properties: [],
    };

    const merged = mergeTrussCss([source1, source2]);
    // "df" should appear only once
    const dfCount = merged.split(".df { display: flex; }").length - 1;
    expect(dfCount).toBe(1);
    // All unique rules present
    expect(merged).toContain(".black { color: #353535; }");
    expect(merged).toContain(".blue { color: #526675; }");
  });

  test("sorts merged rules by priority", () => {
    const source1: ParsedTrussCss = {
      rules: [{ priority: 3130, className: "h_blue", cssText: ".h_blue:hover { color: blue; }" }],
      properties: [],
    };
    const source2: ParsedTrussCss = {
      rules: [
        { priority: 3000, className: "black", cssText: ".black { color: black; }" },
        { priority: 3200, className: "sm_blue", cssText: "@media (...) { .sm_blue.sm_blue { color: blue; } }" },
      ],
      properties: [],
    };

    const merged = mergeTrussCss([source1, source2]);
    const blackIdx = merged.indexOf(".black {");
    const hoverIdx = merged.indexOf(".h_blue:hover {");
    const mediaIdx = merged.indexOf(".sm_blue.sm_blue {");
    expect(blackIdx).toBeLessThan(hoverIdx);
    expect(hoverIdx).toBeLessThan(mediaIdx);
  });

  test("deduplicates @property declarations by variable name", () => {
    const source1: ParsedTrussCss = {
      rules: [{ priority: 4000.5, className: "mt_var", cssText: ".mt_var { margin-top: var(--marginTop); }" }],
      properties: [{ cssText: '@property --marginTop { syntax: "*"; inherits: false; }', varName: "--marginTop" }],
    };
    const source2: ParsedTrussCss = {
      rules: [{ priority: 4000.5, className: "mt_var", cssText: ".mt_var { margin-top: var(--marginTop); }" }],
      properties: [
        { cssText: '@property --marginTop { syntax: "*"; inherits: false; }', varName: "--marginTop" },
        { cssText: '@property --width { syntax: "*"; inherits: false; }', varName: "--width" },
      ],
    };

    const merged = mergeTrussCss([source1, source2]);
    const marginTopCount = merged.split("@property --marginTop").length - 1;
    expect(marginTopCount).toBe(1);
    expect(merged).toContain("@property --width");
  });

  test("@property declarations appear after all rules", () => {
    const source: ParsedTrussCss = {
      rules: [
        { priority: 4000.5, className: "mt_var", cssText: ".mt_var { margin-top: var(--marginTop); }" },
        { priority: 3000, className: "df", cssText: ".df { display: flex; }" },
      ],
      properties: [{ cssText: '@property --marginTop { syntax: "*"; inherits: false; }', varName: "--marginTop" }],
    };

    const merged = mergeTrussCss([source]);
    const lastRuleIdx = merged.indexOf(".mt_var {");
    const propertyIdx = merged.indexOf("@property --marginTop");
    expect(lastRuleIdx).toBeLessThan(propertyIdx);
  });

  test("preserves priority annotations in output", () => {
    const source: ParsedTrussCss = {
      rules: [{ priority: 3000, className: "df", cssText: ".df { display: flex; }" }],
      properties: [{ cssText: '@property --marginTop { syntax: "*"; inherits: false; }', varName: "--marginTop" }],
    };

    const merged = mergeTrussCss([source]);
    expect(merged).toContain("/* @truss p:3000 c:df */");
    expect(merged).toContain("/* @truss @property */");
  });

  test("handles empty sources", () => {
    const merged = mergeTrussCss([]);
    expect(merged).toBe("");
  });

  test("handles source with only @property declarations", () => {
    const source: ParsedTrussCss = {
      rules: [],
      properties: [{ cssText: '@property --color { syntax: "*"; inherits: false; }', varName: "--color" }],
    };

    const merged = mergeTrussCss([source]);
    expect(merged).toContain("@property --color");
    expect(merged).toContain("/* @truss @property */");
  });

  test("round-trips through parse and merge", () => {
    // Generate CSS, parse it, merge it, and verify it matches
    const originalCss = [
      "/* @truss p:3000 c:black */",
      ".black { color: #353535; }",
      "/* @truss p:3000 c:df */",
      ".df { display: flex; }",
      "/* @truss p:3130 c:h_blue */",
      ".h_blue:hover { color: #526675; }",
      "/* @truss @property */",
      '@property --marginTop { syntax: "*"; inherits: false; }',
    ].join("\n");

    const parsed = parseTrussCss(originalCss);
    const merged = mergeTrussCss([parsed]);
    expect(merged).toBe(originalCss);
  });
});
