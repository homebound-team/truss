import { expect, test } from "vitest";
import { type ParsedTrussCss } from "../truss-css";
import { parseTrussCss, serializeTrussCss } from "./truss-css";

test("serialization omits only generated annotations when requested", () => {
  // Given structured CSS with a fractional priority and duplicate fallback declarations
  const css: ParsedTrussCss = {
    rules: [
      {
        priority: 3000.5,
        className: "flex",
        cssText: "@media (min-width: 600px) { .flex { display: block; display: flex; } }",
      },
    ],
    properties: [
      {
        varName: "--color",
        cssText: '@property --color { syntax: "<color>"; inherits: false; initial-value: red; }',
      },
    ],
    keyframes: [{ name: "spin", cssText: "@keyframes spin { to { transform: rotate(360deg); } }" }],
    arbitraryCssBlocks: [{ cssText: '/* user comment */\n.label::after { content: "/* @truss literal */"; }' }],
  };

  // When serialized for a library, then all metadata survives a parser round trip
  expect(serializeTrussCss(css)).toBe(
    [
      "/* @truss p:3000.5 c:flex */",
      css.rules[0].cssText,
      "/* @truss @property */",
      css.properties[0].cssText,
      "/* @truss @keyframes */",
      css.keyframes[0].cssText,
      "/* @truss arbitrary:start */",
      css.arbitraryCssBlocks[0].cssText,
      "/* @truss arbitrary:end */",
    ].join("\n"),
  );
  expect(parseTrussCss(serializeTrussCss(css))).toEqual(css);

  // When serialized for an application, then CSS bodies and user comments remain unchanged
  expect(serializeTrussCss(css, false)).toBe(
    [css.rules[0].cssText, css.properties[0].cssText, css.keyframes[0].cssText, css.arbitraryCssBlocks[0].cssText].join(
      "\n",
    ),
  );
});

test.each([true, false])("empty CSS stays empty with annotate=%s", (annotate) => {
  expect(serializeTrussCss({ rules: [], properties: [], keyframes: [], arbitraryCssBlocks: [] }, annotate)).toBe("");
});
