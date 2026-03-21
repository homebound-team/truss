import { describe, expect, test } from "vitest";
import { mergeProps, TrussDebugInfo, trussProps } from "./runtime";

describe("runtime", () => {
  test("trussProps strips debug info and adds compact data-truss-src", () => {
    const calls: unknown[][] = [];
    const stylexNs = {
      props: function (...styles: unknown[]) {
        calls.push(styles);
        return { className: "x1 x2" };
      },
    };

    const result = trussProps(
      stylexNs as never,
      new TrussDebugInfo("TextFieldBase.tsx:25"),
      "style-a",
      new TrussDebugInfo("Label.tsx:7"),
      new TrussDebugInfo("TextFieldBase.tsx:25"),
      "style-b",
    );

    expect(calls).toEqual([["style-a", "style-b"]]);
    expect(result).toEqual({
      className: "x1 x2",
      "data-truss-src": "TextFieldBase.tsx:25; Label.tsx:7",
    });
  });

  test("mergeProps preserves className while adding data-truss-src", () => {
    const stylexNs = {
      props: function (...styles: unknown[]) {
        expect(styles).toEqual(["style-a"]);
        return { className: "x1" };
      },
    };

    const result = mergeProps(stylexNs as never, "existing", new TrussDebugInfo("Field.tsx:11"), "style-a");

    expect(result).toEqual({
      className: "existing x1",
      "data-truss-src": "Field.tsx:11",
    });
  });
});
