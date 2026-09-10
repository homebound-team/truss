import { describe, expect, test } from "vitest";
import { ruleSortKey } from "../css-order";
import type { TestCssPayload } from "../test-css";
import { createTestCssPayload, splitArbitraryCss } from "./test-css";

describe("createTestCssPayload", () => {
  test("omits empty arrays and caller metadata", () => {
    expect(createTestCssPayload({ rules: [], properties: [], arbitraryCssBlocks: [] })).toEqual({});
    expect(
      createTestCssPayload({ rules: [], properties: [], arbitraryCssBlocks: [{ cssText: "/* only */" }] }),
    ).toEqual({});
  });

  test("preserves atomic priority, class, and one-sided query metadata through JSON", () => {
    const payload = createTestCssPayload({
      rules: [
        { priority: 3000, className: "blue", cssText: ".blue { color: blue; }" },
        {
          priority: 3200.5,
          className: "lg_blue",
          cssText: "@media (min-width: 960px) { .lg_blue.lg_blue { color: blue; } }",
        },
        {
          priority: 3200,
          className: "sm_blue",
          cssText: "@container card (max-width: 599px) { .sm_blue.sm_blue { color: blue; } }",
        },
      ],
      properties: [{ varName: "--width", cssText: '@property --width { syntax: "*"; inherits: false; }' }],
      arbitraryCssBlocks: [],
    });
    const restored: TestCssPayload = JSON.parse(JSON.stringify(payload));
    expect(restored).toEqual({
      rules: [
        { priority: 3000, className: "blue", cssText: ".blue { color: blue; }" },
        {
          priority: 3200.5,
          className: "lg_blue",
          cssText: "@media (min-width: 960px) { .lg_blue.lg_blue { color: blue; } }",
          atRule: "@media (min-width: 960px)",
        },
        {
          priority: 3200,
          className: "sm_blue",
          cssText: "@container card (max-width: 599px) { .sm_blue.sm_blue { color: blue; } }",
          atRule: "@container card (max-width: 599px)",
        },
      ],
      properties: [{ varName: "--width", cssText: '@property --width { syntax: "*"; inherits: false; }' }],
    });
    const minRule = restored.rules![1];
    const maxRule = restored.rules![2];
    expect(ruleSortKey(minRule.priority, minRule.className, minRule.atRule).widthInterval).toEqual({
      lo: 960,
      hi: Infinity,
    });
    expect(ruleSortKey(maxRule.priority, maxRule.className, maxRule.atRule).widthInterval).toEqual({ lo: 0, hi: 599 });
  });

  test("keeps duplicates across arbitrary blocks without adding caller metadata", () => {
    expect(
      createTestCssPayload({
        rules: [],
        properties: [],
        arbitraryCssBlocks: [{ cssText: "/* first */ .a { color: red; }" }, { cssText: ".a { color: red; }" }],
      }),
    ).toEqual({ arbitraryRules: [".a { color: red; }", ".a { color: red; }"] });
  });
});

describe("splitArbitraryCss", () => {
  test("preserves nested at-rules, quoted punctuation, comments inside rules, and duplicates", () => {
    const rules = [
      '@supports (display: grid) { @media (min-width: 600px) { @container card (max-width: 900px) { @layer cards { .a::before { content: "};{;"; /* inside */ } } } } }',
      "@keyframes fade { from { opacity: 0; } to { opacity: 1; } }",
      '.a[data-value="{;}"] { background: url("data:image/svg+xml;a{b}"); }',
      ".a { color: red; }",
      ".a { color: red; }",
    ];
    expect(splitArbitraryCss(`/* before */\n${rules.join("\n/* between */\n")}\n/* after */`)).toEqual(rules);
  });

  test("preserves semicolons on blockless at-rules and empty blocks", () => {
    expect(splitArbitraryCss('@layer reset, base; @import url("theme;{}.css"); @layer empty {}')).toEqual([
      "@layer reset, base;",
      '@import url("theme;{}.css");',
      "@layer empty {}",
    ]);
  });

  test("preserves opaque unknown at-rule blocks and exact nested whitespace and comments", () => {
    const rule = '@unknown  opaque(foo; bar) {\n  arbitrary tokens; /* nested */\n  nested { x y "};" }\n}';
    expect(splitArbitraryCss(`  ${rule}\n${rule}  `)).toEqual([rule, rule]);
  });

  test("ignores top-level HTML comment delimiters without changing rule slices", () => {
    expect(splitArbitraryCss("<!--\n.a  { /* inside */ color: red; }\n-->\n@layer  base;")).toEqual([
      ".a  { /* inside */ color: red; }",
      "@layer  base;",
    ]);
  });

  test.each([".a { color: red;", '.a { content: "unterminated; }'])(
    "preserves recovered EOF rule text: %s",
    (cssText) => {
      expect(splitArbitraryCss(cssText)).toEqual([cssText]);
      expect(createTestCssPayload({ rules: [], properties: [], arbitraryCssBlocks: [{ cssText }] })).toEqual({
        arbitraryRules: [cssText],
      });
    },
  );

  test("ignores unterminated top-level comments", () => {
    expect(splitArbitraryCss("/* unterminated")).toEqual([]);
    expect(
      createTestCssPayload({ rules: [], properties: [], arbitraryCssBlocks: [{ cssText: "/* unterminated" }] }),
    ).toEqual({});
    expect(splitArbitraryCss(".a { color: red; } /* unterminated")).toEqual([".a { color: red; }"]);
  });
});
