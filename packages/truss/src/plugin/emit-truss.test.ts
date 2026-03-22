import { describe, expect, test } from "vitest";
import { collectAtomicRules, generateCssText, type AtomicRule } from "./emit-truss";
import type { ResolvedSegment, TrussMapping } from "./types";
import type { ResolvedChain } from "./resolve-chain";

const testMapping: TrussMapping = {
  increment: 8,
  breakpoints: {
    ifSm: "@media screen and (max-width: 599px)",
    ifMd: "@media screen and (min-width: 600px) and (max-width: 959px)",
  },
  abbreviations: {},
};

/** Helper to build a minimal ResolvedChain from segments. */
function chain(segments: ResolvedSegment[]): ResolvedChain {
  return { parts: [{ type: "unconditional", segments }], markers: [], errors: [] };
}

describe("collectAtomicRules", () => {
  test("static single-property segment", () => {
    const seg: ResolvedSegment = { key: "df", defs: { display: "flex" } };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("df")).toMatchObject({
      className: "df",
      cssProperty: "display",
      cssValue: "flex",
    });
  });

  test("static multi-property segment", () => {
    const seg: ResolvedSegment = {
      key: "ba",
      defs: { borderStyle: "solid", borderWidth: "1px" },
    };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("ba_borderStyle")).toMatchObject({
      className: "ba_borderStyle",
      cssProperty: "border-style",
      cssValue: "solid",
    });
    expect(rules.get("ba_borderWidth")).toMatchObject({
      className: "ba_borderWidth",
      cssProperty: "border-width",
      cssValue: "1px",
    });
  });

  test("static with pseudo-class", () => {
    const seg: ResolvedSegment = {
      key: "blue__hover",
      defs: { color: { default: null, ":hover": "#526675" } },
      pseudoClass: ":hover",
    };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("h_blue")).toMatchObject({
      className: "h_blue",
      cssProperty: "color",
      cssValue: "#526675",
      pseudoClass: ":hover",
    });
  });

  test("static with media query", () => {
    const seg: ResolvedSegment = {
      key: "blue__sm",
      defs: { color: { default: null, "@media screen and (max-width: 599px)": "#526675" } },
      mediaQuery: "@media screen and (max-width: 599px)",
    };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("sm_blue")).toMatchObject({
      className: "sm_blue",
      cssProperty: "color",
      cssValue: "#526675",
      mediaQuery: "@media screen and (max-width: 599px)",
    });
  });

  test("static with pseudo-element", () => {
    const seg: ResolvedSegment = {
      key: "blue__placeholder",
      defs: { "::placeholder": { color: "#526675" } },
      pseudoElement: "::placeholder",
    };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("placeholder_blue")).toMatchObject({
      className: "placeholder_blue",
      cssProperty: "color",
      cssValue: "#526675",
      pseudoElement: "::placeholder",
    });
  });

  test("variable segment", () => {
    const seg: ResolvedSegment = {
      key: "mt",
      defs: {},
      variableProps: ["marginTop"],
      incremented: true,
      argNode: { type: "Identifier", name: "x" },
    };
    const result = collectAtomicRules([chain([seg])], testMapping);
    expect(result.needsMaybeInc).toBe(true);
    expect(result.rules.get("mt_var")).toMatchObject({
      className: "mt_var",
      cssProperty: "margin-top",
      cssValue: "var(--marginTop)",
      cssVarName: "--marginTop",
    });
  });

  test("variable segment with multiple props keeps one class and multiple declarations", () => {
    const seg: ResolvedSegment = {
      key: "sq",
      defs: {},
      variableProps: ["height", "width"],
      appendPx: true,
      argNode: { type: "Identifier", name: "x" },
    };
    const result = collectAtomicRules([chain([seg])], testMapping);
    expect(result.rules.get("sq_var")).toMatchObject({
      className: "sq_var",
      cssProperty: "height",
      cssValue: "var(--height)",
      cssVarName: "--height",
      declarations: [
        { cssProperty: "height", cssValue: "var(--height)", cssVarName: "--height" },
        { cssProperty: "width", cssValue: "var(--width)", cssVarName: "--width" },
      ],
    });
  });

  test("variable with hover", () => {
    const seg: ResolvedSegment = {
      key: "bc__hover",
      defs: {},
      variableProps: ["borderColor"],
      pseudoClass: ":hover",
      argNode: { type: "Identifier", name: "y" },
    };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("h_bc_var")).toMatchObject({
      className: "h_bc_var",
      cssProperty: "border-color",
      cssValue: "var(--h_borderColor)",
      pseudoClass: ":hover",
      cssVarName: "--h_borderColor",
    });
  });
});

describe("generateCssText", () => {
  test("base rule", () => {
    const rules = new Map<string, AtomicRule>([["df", { className: "df", cssProperty: "display", cssValue: "flex" }]]);
    const css = generateCssText(rules);
    expect(css).toContain(".df {\n  display: flex;\n}");
  });

  test("pseudo-class rule", () => {
    const rules = new Map<string, AtomicRule>([
      ["h_blue", { className: "h_blue", cssProperty: "color", cssValue: "#526675", pseudoClass: ":hover" }],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain(".h_blue:hover {\n  color: #526675;\n}");
  });

  test("media query rule uses doubled selector", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "sm_blue",
        {
          className: "sm_blue",
          cssProperty: "color",
          cssValue: "#526675",
          mediaQuery: "@media screen and (max-width: 599px)",
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain("@media screen and (max-width: 599px) {\n  .sm_blue.sm_blue {\n    color: #526675;\n  }\n}");
  });

  test("media + pseudo uses doubled selector + pseudo", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "sm_h_blue",
        {
          className: "sm_h_blue",
          cssProperty: "color",
          cssValue: "#526675",
          mediaQuery: "@media screen and (max-width: 599px)",
          pseudoClass: ":hover",
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain(
      "@media screen and (max-width: 599px) {\n  .sm_h_blue.sm_h_blue:hover {\n    color: #526675;\n  }\n}",
    );
  });

  test("pseudo-element rule", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "placeholder_blue",
        {
          className: "placeholder_blue",
          cssProperty: "color",
          cssValue: "#526675",
          pseudoElement: "::placeholder",
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain(".placeholder_blue::placeholder {\n  color: #526675;\n}");
  });

  test("variable rule includes @property", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "mt_var",
        {
          className: "mt_var",
          cssProperty: "margin-top",
          cssValue: "var(--marginTop)",
          cssVarName: "--marginTop",
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain(".mt_var {\n  margin-top: var(--marginTop);\n}");
    expect(css).toContain('@property --marginTop {\n  syntax: "*";\n  inherits: false;\n}');
  });

  test("multi-prop variable rule includes all declarations and @property entries", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "sq_var",
        {
          className: "sq_var",
          cssProperty: "height",
          cssValue: "var(--height)",
          cssVarName: "--height",
          declarations: [
            { cssProperty: "height", cssValue: "var(--height)", cssVarName: "--height" },
            { cssProperty: "width", cssValue: "var(--width)", cssVarName: "--width" },
          ],
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain(".sq_var {\n  height: var(--height);\n  width: var(--width);\n}");
    expect(css).toContain('@property --height {\n  syntax: "*";\n  inherits: false;\n}');
    expect(css).toContain('@property --width {\n  syntax: "*";\n  inherits: false;\n}');
  });

  test("ordering: base before pseudo before media", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "sm_blue",
        {
          className: "sm_blue",
          cssProperty: "color",
          cssValue: "blue",
          mediaQuery: "@media screen and (max-width: 599px)",
        },
      ],
      ["black", { className: "black", cssProperty: "color", cssValue: "black" }],
      ["h_blue", { className: "h_blue", cssProperty: "color", cssValue: "blue", pseudoClass: ":hover" }],
    ]);
    const css = generateCssText(rules);
    const baseIdx = css.indexOf(".black {");
    const pseudoIdx = css.indexOf(".h_blue:hover {");
    const mediaIdx = css.indexOf(".sm_blue.sm_blue {");
    expect(baseIdx).toBeLessThan(pseudoIdx);
    expect(pseudoIdx).toBeLessThan(mediaIdx);
  });

  test("pseudo ordering: hover before focus before active", () => {
    const rules = new Map<string, AtomicRule>([
      ["a_red", { className: "a_red", cssProperty: "color", cssValue: "red", pseudoClass: ":active" }],
      ["h_blue", { className: "h_blue", cssProperty: "color", cssValue: "blue", pseudoClass: ":hover" }],
      ["f_green", { className: "f_green", cssProperty: "color", cssValue: "green", pseudoClass: ":focus" }],
    ]);
    const css = generateCssText(rules);
    const hoverIdx = css.indexOf(".h_blue:hover");
    const focusIdx = css.indexOf(".f_green:focus");
    const activeIdx = css.indexOf(".a_red:active");
    expect(hoverIdx).toBeLessThan(focusIdx);
    expect(focusIdx).toBeLessThan(activeIdx);
  });
});
