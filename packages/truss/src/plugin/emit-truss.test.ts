import { describe, expect, test } from "vitest";
import { collectAtomicRules, generateCssText, type AtomicRule } from "./emit-truss";
import { computeRulePriority } from "./priority";
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
    const seg: ResolvedSegment = { abbr: "df", defs: { display: "flex" } };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("df")).toMatchObject({
      className: "df",
      cssProperty: "display",
      cssValue: "flex",
    });
  });

  test("static multi-property segment", () => {
    const seg: ResolvedSegment = {
      abbr: "ba",
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
      abbr: "blue",
      defs: { color: "#526675" },
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
      abbr: "blue",
      defs: { color: "#526675" },
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
      abbr: "blue",
      defs: { color: "#526675" },
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
      abbr: "mt",
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
      abbr: "sq",
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
      abbr: "bc",
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

  test("custom pseudo selectors build a safe class token", () => {
    const seg: ResolvedSegment = {
      abbr: "black",
      defs: { color: "#353535" },
      pseudoClass: ":hover:not(:disabled)",
    };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("h_n_d_black")).toMatchObject({
      className: "h_n_d_black",
      cssProperty: "color",
      cssValue: "#353535",
      pseudoClass: ":hover:not(:disabled)",
    });
  });
});

describe("generateCssText", () => {
  test("base rule with annotation", () => {
    const rules = new Map<string, AtomicRule>([["df", { className: "df", cssProperty: "display", cssValue: "flex" }]]);
    const css = generateCssText(rules);
    expect(css).toBe("/* @truss p:3000 c:df */\n.df { display: flex; }");
  });

  test("pseudo-class rule", () => {
    const rules = new Map<string, AtomicRule>([
      ["h_blue", { className: "h_blue", cssProperty: "color", cssValue: "#526675", pseudoClass: ":hover" }],
    ]);
    const css = generateCssText(rules);
    expect(css).toBe("/* @truss p:3130 c:h_blue */\n.h_blue:hover { color: #526675; }");
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
    expect(css).toBe(
      "/* @truss p:3200 c:sm_blue */\n@media screen and (max-width: 599px) { .sm_blue.sm_blue { color: #526675; } }",
    );
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
    expect(css).toBe(
      "/* @truss p:3330 c:sm_h_blue */\n@media screen and (max-width: 599px) { .sm_h_blue.sm_h_blue:hover { color: #526675; } }",
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
    expect(css).toBe("/* @truss p:8000 c:placeholder_blue */\n.placeholder_blue::placeholder { color: #526675; }");
  });

  test("custom pseudo selector rule keeps the raw selector", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "h_n_d_black",
        {
          className: "h_n_d_black",
          cssProperty: "color",
          cssValue: "#353535",
          pseudoClass: ":hover:not(:disabled)",
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(stripAnnotations(css)).toBe(".h_n_d_black:hover:not(:disabled) { color: #353535; }");
  });

  test("variable rule includes @property with annotation", () => {
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
    expect(css).toBe(
      [
        "/* @truss p:4000.5 c:mt_var */",
        ".mt_var { margin-top: var(--marginTop); }",
        "/* @truss @property */",
        '@property --marginTop { syntax: "*"; inherits: false; }',
      ].join("\n"),
    );
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
    expect(css).toBe(
      [
        "/* @truss p:4000.5 c:sq_var */",
        ".sq_var { height: var(--height); width: var(--width); }",
        "/* @truss @property */",
        '@property --height { syntax: "*"; inherits: false; }',
        "/* @truss @property */",
        '@property --width { syntax: "*"; inherits: false; }',
      ].join("\n"),
    );
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
    const css = stripAnnotations(generateCssText(rules));
    const baseIdx = css.indexOf(".black {");
    const pseudoIdx = css.indexOf(".h_blue:hover {");
    const mediaIdx = css.indexOf(".sm_blue.sm_blue {");
    expect(baseIdx).toBeLessThan(pseudoIdx);
    expect(pseudoIdx).toBeLessThan(mediaIdx);
  });

  test("ordering: static base rules stay before variable rules for the same property", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "w_var",
        {
          className: "w_var",
          cssProperty: "width",
          cssValue: "var(--width)",
          cssVarName: "--width",
        },
      ],
      ["w100", { className: "w100", cssProperty: "width", cssValue: "100%" }],
    ]);
    const css = stripAnnotations(generateCssText(rules));
    const staticIdx = css.indexOf(".w100 {");
    const variableIdx = css.indexOf(".w_var {");
    expect(staticIdx).toBeLessThan(variableIdx);
  });

  test("pseudo ordering: hover before focus before active", () => {
    const rules = new Map<string, AtomicRule>([
      ["a_red", { className: "a_red", cssProperty: "color", cssValue: "red", pseudoClass: ":active" }],
      ["h_blue", { className: "h_blue", cssProperty: "color", cssValue: "blue", pseudoClass: ":hover" }],
      ["f_green", { className: "f_green", cssProperty: "color", cssValue: "green", pseudoClass: ":focus" }],
    ]);
    const css = stripAnnotations(generateCssText(rules));
    const hoverIdx = css.indexOf(".h_blue:hover");
    const focusIdx = css.indexOf(".f_green:focus");
    const activeIdx = css.indexOf(".a_red:active");
    expect(hoverIdx).toBeLessThan(focusIdx);
    expect(focusIdx).toBeLessThan(activeIdx);
  });

  test("shorthand border-color emits before longhand border-top-color", () => {
    const rules = new Map<string, AtomicRule>([
      ["btc_red", { className: "btc_red", cssProperty: "border-top-color", cssValue: "red" }],
      ["bc_white", { className: "bc_white", cssProperty: "border-color", cssValue: "white" }],
    ]);
    const css = stripAnnotations(generateCssText(rules));
    const bcIdx = css.indexOf(".bc_white {");
    const btcIdx = css.indexOf(".btc_red {");
    expect(bcIdx).toBeLessThan(btcIdx);
  });

  test("shorthand border-color variable emits before longhand border-top-color variable", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "btc_var",
        {
          className: "btc_var",
          cssProperty: "border-top-color",
          cssValue: "var(--borderTopColor)",
          cssVarName: "--borderTopColor",
        },
      ],
      [
        "bc_var",
        {
          className: "bc_var",
          cssProperty: "border-color",
          cssValue: "var(--borderColor)",
          cssVarName: "--borderColor",
        },
      ],
    ]);
    const css = stripAnnotations(generateCssText(rules));
    const bcIdx = css.indexOf(".bc_var {");
    const btcIdx = css.indexOf(".btc_var {");
    expect(bcIdx).toBeLessThan(btcIdx);
  });

  test("shorthand margin emits before longhand margin-top", () => {
    const rules = new Map<string, AtomicRule>([
      ["mt0", { className: "mt0", cssProperty: "margin-top", cssValue: "0" }],
      ["m0", { className: "m0", cssProperty: "margin", cssValue: "0" }],
    ]);
    const css = stripAnnotations(generateCssText(rules));
    const mIdx = css.indexOf(".m0 {");
    const mtIdx = css.indexOf(".mt0 {");
    expect(mIdx).toBeLessThan(mtIdx);
  });

  test("shorthand padding emits before padding-left", () => {
    const rules = new Map<string, AtomicRule>([
      ["pl8", { className: "pl8", cssProperty: "padding-left", cssValue: "8px" }],
      ["p0", { className: "p0", cssProperty: "padding", cssValue: "0" }],
    ]);
    const css = stripAnnotations(generateCssText(rules));
    const pIdx = css.indexOf(".p0 {");
    const plIdx = css.indexOf(".pl8 {");
    expect(pIdx).toBeLessThan(plIdx);
  });

  test("border (shorthand-of-shorthands) before border-color (shorthand-of-longhands) before border-top-color (longhand)", () => {
    const rules = new Map<string, AtomicRule>([
      ["btc_red", { className: "btc_red", cssProperty: "border-top-color", cssValue: "red" }],
      ["bc_blue", { className: "bc_blue", cssProperty: "border-color", cssValue: "blue" }],
      ["b_none", { className: "b_none", cssProperty: "border", cssValue: "none" }],
    ]);
    const css = stripAnnotations(generateCssText(rules));
    const borderIdx = css.indexOf(".b_none {");
    const bcIdx = css.indexOf(".bc_blue {");
    const btcIdx = css.indexOf(".btc_red {");
    expect(borderIdx).toBeLessThan(bcIdx);
    expect(bcIdx).toBeLessThan(btcIdx);
  });

  test("same-priority rules are deterministic regardless of insertion order", () => {
    const rulesForward = new Map<string, AtomicRule>([
      ["absolute", { className: "absolute", cssProperty: "position", cssValue: "absolute" }],
      ["bgBlue700", { className: "bgBlue700", cssProperty: "background-color", cssValue: "blue" }],
      ["bgWhite", { className: "bgWhite", cssProperty: "background-color", cssValue: "white" }],
    ]);
    const rulesReverse = new Map<string, AtomicRule>([
      ["bgWhite", { className: "bgWhite", cssProperty: "background-color", cssValue: "white" }],
      ["bgBlue700", { className: "bgBlue700", cssProperty: "background-color", cssValue: "blue" }],
      ["absolute", { className: "absolute", cssProperty: "position", cssValue: "absolute" }],
    ]);
    // Both insertion orders must produce the same output
    expect(generateCssText(rulesForward)).toBe(generateCssText(rulesReverse));
    // And the alphabetical order should be: absolute, bgBlue700, bgWhite
    const css = stripAnnotations(generateCssText(rulesForward));
    const absIdx = css.indexOf(".absolute {");
    const blueIdx = css.indexOf(".bgBlue700 {");
    const whiteIdx = css.indexOf(".bgWhite {");
    expect(absIdx).toBeLessThan(blueIdx);
    expect(blueIdx).toBeLessThan(whiteIdx);
  });

  test("disabled pseudo-class sorts after hover and active", () => {
    const rules = new Map<string, AtomicRule>([
      ["d_gray", { className: "d_gray", cssProperty: "color", cssValue: "gray", pseudoClass: ":disabled" }],
      ["h_blue", { className: "h_blue", cssProperty: "color", cssValue: "blue", pseudoClass: ":hover" }],
      ["a_red", { className: "a_red", cssProperty: "color", cssValue: "red", pseudoClass: ":active" }],
    ]);
    const css = stripAnnotations(generateCssText(rules));
    const hoverIdx = css.indexOf(".h_blue:hover");
    const activeIdx = css.indexOf(".a_red:active");
    // :disabled is not in LVFHA but stylex gives it priority 92, which is < :hover (130)
    // So :disabled should come before :hover
    expect(css.indexOf(".d_gray:disabled")).toBeLessThan(hoverIdx);
    expect(hoverIdx).toBeLessThan(activeIdx);
  });
});

describe("computeRulePriority", () => {
  test("property tiers: shorthand-of-shorthands < shorthand-of-longhands < longhand < physical longhand", () => {
    const border = computeRulePriority({ className: "b", cssProperty: "border", cssValue: "none" });
    const borderColor = computeRulePriority({ className: "bc", cssProperty: "border-color", cssValue: "white" });
    const color = computeRulePriority({ className: "c", cssProperty: "color", cssValue: "red" });
    const borderTopColor = computeRulePriority({
      className: "btc",
      cssProperty: "border-top-color",
      cssValue: "red",
    });
    expect(border).toBe(1000);
    expect(borderColor).toBe(2000);
    expect(color).toBe(3000);
    expect(borderTopColor).toBe(4000);
  });

  test("pseudo-class adds to property priority", () => {
    const base = computeRulePriority({ className: "c", cssProperty: "color", cssValue: "red" });
    const hover = computeRulePriority({
      className: "h_c",
      cssProperty: "color",
      cssValue: "red",
      pseudoClass: ":hover",
    });
    const active = computeRulePriority({
      className: "a_c",
      cssProperty: "color",
      cssValue: "red",
      pseudoClass: ":active",
    });
    expect(base).toBe(3000);
    expect(hover).toBe(3130);
    expect(active).toBe(3170);
  });

  test("pseudo-class priority normalizes camelCase and kebab-case names", () => {
    const focusWithin = computeRulePriority({
      className: "fw_c",
      cssProperty: "color",
      cssValue: "red",
      pseudoClass: ":focus-within",
    });
    const focusWithinCamel = computeRulePriority({
      className: "fw_c_alt",
      cssProperty: "color",
      cssValue: "red",
      pseudoClass: ":focusWithin",
    });
    const focusVisible = computeRulePriority({
      className: "fv_c",
      cssProperty: "color",
      cssValue: "red",
      pseudoClass: ":focus-visible",
    });
    const focusVisibleCamel = computeRulePriority({
      className: "fv_c_alt",
      cssProperty: "color",
      cssValue: "red",
      pseudoClass: ":focusVisible",
    });
    expect(focusWithin).toBe(3140);
    expect(focusWithinCamel).toBe(3140);
    expect(focusVisible).toBe(3160);
    expect(focusVisibleCamel).toBe(3160);
  });

  test("custom pseudo selectors use the leading pseudo for priority", () => {
    const priority = computeRulePriority({
      className: "h_n_d_c",
      cssProperty: "color",
      cssValue: "red",
      pseudoClass: ":hover:not(:disabled)",
    });
    expect(priority).toBe(3130);
  });

  test("media query adds 200", () => {
    const base = computeRulePriority({ className: "c", cssProperty: "color", cssValue: "red" });
    const media = computeRulePriority({
      className: "sm_c",
      cssProperty: "color",
      cssValue: "red",
      mediaQuery: "@media (max-width: 599px)",
    });
    expect(media - base).toBe(200);
  });

  test("pseudo-element adds 5000", () => {
    const base = computeRulePriority({ className: "c", cssProperty: "color", cssValue: "red" });
    const pe = computeRulePriority({
      className: "ph_c",
      cssProperty: "color",
      cssValue: "red",
      pseudoElement: "::placeholder",
    });
    expect(pe - base).toBe(5000);
  });

  test("additive composition: hover + media", () => {
    const priority = computeRulePriority({
      className: "sm_h_c",
      cssProperty: "color",
      cssValue: "red",
      pseudoClass: ":hover",
      mediaQuery: "@media (max-width: 599px)",
    });
    // 3000 (longhand) + 130 (:hover) + 200 (@media)
    expect(priority).toBe(3330);
  });

  test("variable rules get +0.5 to sort after static rules for same property", () => {
    const staticRule = computeRulePriority({ className: "w100", cssProperty: "width", cssValue: "100%" });
    const varRule = computeRulePriority({
      className: "w_var",
      cssProperty: "width",
      cssValue: "var(--width)",
      cssVarName: "--width",
    });
    expect(varRule).toBe(staticRule + 0.5);
  });

  test("unknown properties default to 3000 (longhand)", () => {
    const priority = computeRulePriority({
      className: "custom",
      cssProperty: "some-unknown-property",
      cssValue: "value",
    });
    expect(priority).toBe(3000);
  });
});

/** Strip priority annotation comments from CSS text for tests that just check rule content. */
function stripAnnotations(css: string): string {
  return css
    .split("\n")
    .filter((line) => !line.startsWith("/* @truss "))
    .join("\n");
}
