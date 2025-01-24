import { Css } from "./Css";

describe("Css", () => {
  it("can add mb", () => {
    expect(Css.mb1.$).toMatchInlineSnapshot(`
      {
        "marginBottom": "8px",
      }
    `);
  });
});
