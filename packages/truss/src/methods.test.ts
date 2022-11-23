import { Config } from "src/config";
import { newIncrementMethods } from "src/methods";

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
      expect(newIncrementMethods(config, "mt", "marginTop")).toMatchInlineSnapshot(`
        [
          "/** Sets \`marginTop: "0px"\`. */
         get mt0() { return this.mt(0); }",
          "/** Sets \`marginTop: "8px"\`. */
         get mt1() { return this.mt(1); }",
          "/** Sets \`marginTop: "16px"\`. */
         get mt2() { return this.mt(2); }",
          "/** Sets \`marginTop: "24px"\`. */
         get mt3() { return this.mt(3); }",
          "/** Sets \`marginTop: inc\`. */
         mt(inc: number | string) { return this.add("marginTop", maybeInc(inc)); }",
          "/** Sets \`marginTop: px\`. */
         mtPx(px: number) { return this.mt(\`\${px}px\`); }",
        ]
      `);
    });

    it("can handle mx", () => {
      expect(newIncrementMethods(config, "mx", ["ml", "mr"])).toMatchInlineSnapshot(`
        [
          "/** Sets \`ml: "0px"; mr: "0px"\`. */
         get mx0() { return this.mx(0); }",
          "/** Sets \`ml: "8px"; mr: "8px"\`. */
         get mx1() { return this.mx(1); }",
          "/** Sets \`ml: "16px"; mr: "16px"\`. */
         get mx2() { return this.mx(2); }",
          "/** Sets \`ml: "24px"; mr: "24px"\`. */
         get mx3() { return this.mx(3); }",
          "mx(inc: number | string) { return this.ml(inc).mr(inc); }",
          "mxPx(px: number) { return this.mlPx(px).mrPx(px); }",
        ]
      `);
    });

    it("can handle m", () => {
      expect(newIncrementMethods(config, "m", ["mt", "mr", "mb", "ml"])).toMatchInlineSnapshot(`
        [
          "/** Sets \`mt: "0px"; mr: "0px"; mb: "0px"; ml: "0px"\`. */
         get m0() { return this.m(0); }",
          "/** Sets \`mt: "8px"; mr: "8px"; mb: "8px"; ml: "8px"\`. */
         get m1() { return this.m(1); }",
          "/** Sets \`mt: "16px"; mr: "16px"; mb: "16px"; ml: "16px"\`. */
         get m2() { return this.m(2); }",
          "/** Sets \`mt: "24px"; mr: "24px"; mb: "24px"; ml: "24px"\`. */
         get m3() { return this.m(3); }",
          "m(inc: number | string) { return this.mt(inc).mr(inc).mb(inc).ml(inc); }",
          "mPx(px: number) { return this.mtPx(px).mrPx(px).mbPx(px).mlPx(px); }",
        ]
      `);
    });
  });
});
