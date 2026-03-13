import { Css } from "./Css";
import { describe, expect, it } from "vitest";

describe("Css", () => {
  it("can add mb", () => {
    expect(Css.mb1.$).toMatchInlineSnapshot(`
      {
        "marginBottom": "8px",
      }
    `);
  });
});
