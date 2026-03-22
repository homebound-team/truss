import { describe, expect, test } from "vitest";
import { collectAtomicRules, generateCssText, type AtomicRule } from "./emit-truss";
import type { ResolvedSegment, TrussMapping } from "./types";
import type { ResolvedChain } from "./resolve-chain";

const testMapping: TrussMapping = {
  increment: 8,
  breakpoints: {
    ifSm: "@media (max-width: 599px)",
    ifMd: "@media (min-width: 600px) and (max-width: 959px)",
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
    expect(rules.get("blue_h")).toMatchObject({
      className: "blue_h",
      cssProperty: "color",
      cssValue: "#526675",
      pseudoClass: ":hover",
    });
  });

  test("static with media query", () => {
    const seg: ResolvedSegment = {
      key: "blue__sm",
      defs: { color: { default: null, "@media (max-width: 599px)": "#526675" } },
      mediaQuery: "@media (max-width: 599px)",
    };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("blue_sm")).toMatchObject({
      className: "blue_sm",
      cssProperty: "color",
      cssValue: "#526675",
      mediaQuery: "@media (max-width: 599px)",
    });
  });

  test("static with pseudo-element", () => {
    const seg: ResolvedSegment = {
      key: "blue__placeholder",
      defs: { "::placeholder": { color: "#526675" } },
      pseudoElement: "::placeholder",
    };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("blue_placeholder")).toMatchObject({
      className: "blue_placeholder",
      cssProperty: "color",
      cssValue: "#526675",
      pseudoElement: "::placeholder",
    });
  });

  test("dynamic segment", () => {
    const seg: ResolvedSegment = {
      key: "mt",
      defs: {},
      dynamicProps: ["marginTop"],
      incremented: true,
      argNode: { type: "Identifier", name: "x" },
    };
    const result = collectAtomicRules([chain([seg])], testMapping);
    expect(result.needsMaybeInc).toBe(true);
    expect(result.rules.get("mt_dyn")).toMatchObject({
      className: "mt_dyn",
      cssProperty: "margin-top",
      cssValue: "var(--mt_dyn)",
      cssVarName: "--mt_dyn",
    });
  });

  test("dynamic with hover", () => {
    const seg: ResolvedSegment = {
      key: "bc__hover",
      defs: {},
      dynamicProps: ["borderColor"],
      pseudoClass: ":hover",
      argNode: { type: "Identifier", name: "y" },
    };
    const { rules } = collectAtomicRules([chain([seg])], testMapping);
    expect(rules.get("bc_dyn_h")).toMatchObject({
      className: "bc_dyn_h",
      cssProperty: "border-color",
      cssValue: "var(--bc_dyn_h)",
      pseudoClass: ":hover",
      cssVarName: "--bc_dyn_h",
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
      ["blue_h", { className: "blue_h", cssProperty: "color", cssValue: "#526675", pseudoClass: ":hover" }],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain(".blue_h:hover {\n  color: #526675;\n}");
  });

  test("media query rule uses doubled selector", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "blue_sm",
        {
          className: "blue_sm",
          cssProperty: "color",
          cssValue: "#526675",
          mediaQuery: "@media (max-width: 599px)",
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain("@media (max-width: 599px) {\n  .blue_sm.blue_sm {\n    color: #526675;\n  }\n}");
  });

  test("media + pseudo uses doubled selector + pseudo", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "blue_sm_h",
        {
          className: "blue_sm_h",
          cssProperty: "color",
          cssValue: "#526675",
          mediaQuery: "@media (max-width: 599px)",
          pseudoClass: ":hover",
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain("@media (max-width: 599px) {\n  .blue_sm_h.blue_sm_h:hover {\n    color: #526675;\n  }\n}");
  });

  test("pseudo-element rule", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "blue_placeholder",
        {
          className: "blue_placeholder",
          cssProperty: "color",
          cssValue: "#526675",
          pseudoElement: "::placeholder",
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain(".blue_placeholder::placeholder {\n  color: #526675;\n}");
  });

  test("dynamic rule includes @property", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "mt_dyn",
        {
          className: "mt_dyn",
          cssProperty: "margin-top",
          cssValue: "var(--mt_dyn)",
          cssVarName: "--mt_dyn",
        },
      ],
    ]);
    const css = generateCssText(rules);
    expect(css).toContain(".mt_dyn {\n  margin-top: var(--mt_dyn);\n}");
    expect(css).toContain('@property --mt_dyn {\n  syntax: "*";\n  inherits: false;\n}');
  });

  test("ordering: base before pseudo before media", () => {
    const rules = new Map<string, AtomicRule>([
      [
        "blue_sm",
        { className: "blue_sm", cssProperty: "color", cssValue: "blue", mediaQuery: "@media (max-width: 599px)" },
      ],
      ["black", { className: "black", cssProperty: "color", cssValue: "black" }],
      ["blue_h", { className: "blue_h", cssProperty: "color", cssValue: "blue", pseudoClass: ":hover" }],
    ]);
    const css = generateCssText(rules);
    const baseIdx = css.indexOf(".black {");
    const pseudoIdx = css.indexOf(".blue_h:hover {");
    const mediaIdx = css.indexOf(".blue_sm.blue_sm {");
    expect(baseIdx).toBeLessThan(pseudoIdx);
    expect(pseudoIdx).toBeLessThan(mediaIdx);
  });

  test("pseudo ordering: hover before focus before active", () => {
    const rules = new Map<string, AtomicRule>([
      ["red_a", { className: "red_a", cssProperty: "color", cssValue: "red", pseudoClass: ":active" }],
      ["blue_h", { className: "blue_h", cssProperty: "color", cssValue: "blue", pseudoClass: ":hover" }],
      ["green_f", { className: "green_f", cssProperty: "color", cssValue: "green", pseudoClass: ":focus" }],
    ]);
    const css = generateCssText(rules);
    const hoverIdx = css.indexOf(".blue_h:hover");
    const focusIdx = css.indexOf(".green_f:focus");
    const activeIdx = css.indexOf(".red_a:active");
    expect(hoverIdx).toBeLessThan(focusIdx);
    expect(focusIdx).toBeLessThan(activeIdx);
  });
});
