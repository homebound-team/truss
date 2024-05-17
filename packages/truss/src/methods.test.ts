import { Properties } from "csstype";
import { Config } from "src/config";
import { newIncrementMethods, newMethod, newMethodsForProp, newParamMethod } from "src/methods";

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
      expect(newIncrementMethods(config, "mt", "marginTop", { auto: true })).toMatchInlineSnapshot(`
        [
          "/** Sets \`marginTop: "0px"\`. */
         get mt0() { return this.add("marginTop", "0px"); }",
          "/** Sets \`marginTop: "8px"\`. */
         get mt1() { return this.add("marginTop", "8px"); }",
          "/** Sets \`marginTop: "16px"\`. */
         get mt2() { return this.add("marginTop", "16px"); }",
          "/** Sets \`marginTop: "24px"\`. */
         get mt3() { return this.add("marginTop", "24px"); }",
          "/** Sets \`marginTop: "auto"\`. */
         get mta() { return this.add("marginTop", "auto"); }",
          "/** Sets \`marginTop: "v"\`. */
         mt(v: number | string) { return this.add("marginTop", maybeInc(v)); }",
          "/** Sets \`marginTop: px\`. */
         mtPx(px: number) { return this.add("marginTop", \`\${px}px\`); }",
        ]
      `);
    });

    it("can handle mx", () => {
      expect(newIncrementMethods(config, "mx", ["marginLeft", "marginRight"], { auto: true })).toMatchInlineSnapshot(`
        [
          "/** Sets \`marginLeft: "0px"; marginRight: "0px"\`. */
         get mx0() { return this.add("marginLeft", "0px").add("marginRight", "0px"); }",
          "/** Sets \`marginLeft: "8px"; marginRight: "8px"\`. */
         get mx1() { return this.add("marginLeft", "8px").add("marginRight", "8px"); }",
          "/** Sets \`marginLeft: "16px"; marginRight: "16px"\`. */
         get mx2() { return this.add("marginLeft", "16px").add("marginRight", "16px"); }",
          "/** Sets \`marginLeft: "24px"; marginRight: "24px"\`. */
         get mx3() { return this.add("marginLeft", "24px").add("marginRight", "24px"); }",
          "/** Sets \`marginLeft: "auto"; marginRight: "auto"\`. */
         get mxa() { return this.add("marginLeft", "auto").add("marginRight", "auto"); }",
          "/** Sets \`marginLeft: "v"; marginRight: "v"\`. */
         mx(v: number | string) { return this.add("marginLeft", maybeInc(v)).add("marginRight", maybeInc(v)); }",
          "/** Sets \`marginLeft: px; marginRight: px\`. */
         mxPx(px: number) { return this.add("marginLeft", \`\${px}px\`).add("marginRight", \`\${px}px\`); }",
        ]
      `);
    });

    it("can handle m", () => {
      expect(newIncrementMethods(config, "m", ["marginTop", "marginRight", "marginBottom", "marginLeft"]))
        .toMatchInlineSnapshot(`
        [
          "/** Sets \`marginTop: "0px"; marginRight: "0px"; marginBottom: "0px"; marginLeft: "0px"\`. */
         get m0() { return this.add("marginTop", "0px").add("marginRight", "0px").add("marginBottom", "0px").add("marginLeft", "0px"); }",
          "/** Sets \`marginTop: "8px"; marginRight: "8px"; marginBottom: "8px"; marginLeft: "8px"\`. */
         get m1() { return this.add("marginTop", "8px").add("marginRight", "8px").add("marginBottom", "8px").add("marginLeft", "8px"); }",
          "/** Sets \`marginTop: "16px"; marginRight: "16px"; marginBottom: "16px"; marginLeft: "16px"\`. */
         get m2() { return this.add("marginTop", "16px").add("marginRight", "16px").add("marginBottom", "16px").add("marginLeft", "16px"); }",
          "/** Sets \`marginTop: "24px"; marginRight: "24px"; marginBottom: "24px"; marginLeft: "24px"\`. */
         get m3() { return this.add("marginTop", "24px").add("marginRight", "24px").add("marginBottom", "24px").add("marginLeft", "24px"); }",
          "/** Sets \`marginTop: "v"; marginRight: "v"; marginBottom: "v"; marginLeft: "v"\`. */
         m(v: number | string) { return this.add("marginTop", maybeInc(v)).add("marginRight", maybeInc(v)).add("marginBottom", maybeInc(v)).add("marginLeft", maybeInc(v)); }",
          "/** Sets \`marginTop: px; marginRight: px; marginBottom: px; marginLeft: px\`. */
         mPx(px: number) { return this.add("marginTop", \`\${px}px\`).add("marginRight", \`\${px}px\`).add("marginBottom", \`\${px}px\`).add("marginLeft", \`\${px}px\`); }",
        ]
      `);
    });
  });

  describe("newParamMethod", () => {
    it("creates a new method with a parameter", () => {
      // Given a new method with a parameter
      const result = newParamMethod("bgColor", "backgroundColor");
      // Then it should output the expected method
      expect(result).toMatchInlineSnapshot(`
        "/** Sets \`backgroundColor: value\`. */
         bgColor(value: Properties["backgroundColor"]) { return this.add("backgroundColor", value); }"
      `);
    });

    it("creates a new method with a parameter and additional properties", () => {
      // Given a new method with a parameter and additional properties
      const result = newParamMethod("bgColor", "backgroundColor", { display: "block" });
      // Then it should output the expected method
      expect(result).toMatchInlineSnapshot(`
        "/** Sets \`backgroundColor: value\`. */
         bgColor(value: Properties["backgroundColor"]) { return this.add("backgroundColor", value).add("display", "block"); }"
      `);
    });
  });

  describe("newMethodsForProp", () => {
    it("creates a new method for prop", () => {
      // Given a new method for "lineClamp" prop with different definitions
      const baseProperties: Properties = { overflow: "hidden", textOverflow: "ellipsis" };
      const def: (lineClamp: Properties["WebkitLineClamp"]) => Properties = (lineClamp) => ({
        WebkitLineClamp: lineClamp,
        ...baseProperties,
      });
      // When we create the new methods
      const result = newMethodsForProp("lineClamp", { lineClamp1: def(1), lineClampNone: def("unset") });
      // Then it should output the expected methods
      expect(result).toMatchInlineSnapshot(`
        [
          "/** Sets \`WebkitLineClamp: 1; overflow: "hidden"; textOverflow: "ellipsis"\`. */
         get lineClamp1() { return this.add("WebkitLineClamp", 1).add("overflow", "hidden").add("textOverflow", "ellipsis"); }",
          "/** Sets \`WebkitLineClamp: "unset"; overflow: "hidden"; textOverflow: "ellipsis"\`. */
         get lineClampNone() { return this.add("WebkitLineClamp", "unset").add("overflow", "hidden").add("textOverflow", "ellipsis"); }",
          "/** Sets \`lineClamp: value\`. */
         lineClamp(value: Properties["lineClamp"]) { return this.add("lineClamp", value); }",
        ]
      `);
    });

    it("creates method extra base definitions", () => {
      // Given some base properties
      const baseProperties: Properties = { overflow: "hidden", textOverflow: "ellipsis" };
      // When we call newMethodsForProp with the base properties for "lineClamp"
      const result = newMethodsForProp("WebkitLineClamp", {}, "lineClamp", false, baseProperties);
      // Then it should output a lineClamp function with the base properties
      expect(result).toMatchInlineSnapshot(`
        [
          "/** Sets \`WebkitLineClamp: value\`. */
         lineClamp(value: Properties["WebkitLineClamp"]) { return this.add("WebkitLineClamp", value).add("overflow", "hidden").add("textOverflow", "ellipsis"); }",
        ]
      `);
    });
  });
});
