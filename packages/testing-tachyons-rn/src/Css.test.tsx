import { Css } from "./Css";
import { describe, expect, it } from "vitest";

if (false) {
  // @ts-expect-error React Native Css does not support nested selector helpers.
  Css.addIn(">div", Css.mb1.$);
  // @ts-expect-error React Native Css does not support raw class names.
  Css.className("foo");
  // @ts-expect-error React Native Css does not support important modifiers.
  Css.black.important;
}

describe("Css", () => {
  it("can add mb", () => {
    expect(Css.mb1.$).toMatchInlineSnapshot(`
      {
        "marginBottom": "8px",
      }
    `);
  });
});
