import { Config } from "config";
import { newIncrementMethods } from "./methods";

describe("methods", () => {
  const config: Config = {
    outputPath: "Css.ts",
    increment: 8,
    numberOfIncrements: 3,
    fonts: {},
    palette: {},
  };

  describe("newIncrementMethods", () => {
    it("can handle mt", () => {
      expect(newIncrementMethods(config, "mt", "marginTop"))
        .toMatchInlineSnapshot(`
        Array [
          "get mt0() { return this.mt(0); }",
          "get mt1() { return this.mt(1); }",
          "get mt2() { return this.mt(2); }",
          "get mt3() { return this.mt(3); }",
          "mt(inc: number | string) { return this.add(\\"marginTop\\", maybeInc(inc)); }",
          "mtPx(px: number) { return this.mt(\`\${px}px\`); }",
        ]
      `);
    });

    it("can handle mx", () => {
      expect(newIncrementMethods(config, "mx", ["ml", "mr"]))
        .toMatchInlineSnapshot(`
        Array [
          "get mx0() { return this.mx(0); }",
          "get mx1() { return this.mx(1); }",
          "get mx2() { return this.mx(2); }",
          "get mx3() { return this.mx(3); }",
          "mx(inc: number | string) { return this.ml(inc).mr(inc); }",
          "mxPx(px: number) { return this.mlPx(px).mrPx(px); }",
        ]
      `);
    });

    it("can handle m", () => {
      expect(newIncrementMethods(config, "m", ["mt", "mr", "mb", "ml"]))
        .toMatchInlineSnapshot(`
        Array [
          "get m0() { return this.m(0); }",
          "get m1() { return this.m(1); }",
          "get m2() { return this.m(2); }",
          "get m3() { return this.m(3); }",
          "m(inc: number | string) { return this.mt(inc).mr(inc).mb(inc).ml(inc); }",
          "mPx(px: number) { return this.mtPx(px).mrPx(px).mbPx(px).mlPx(px); }",
        ]
      `);
    });
  });
});
