import { Properties } from "csstype";
import { Config } from "src/config";
import { newIncrementMethods, newMethod, newMethodsForProp, newParamMethod, newPxMethods } from "src/methods";
import { describe, expect, it } from "vitest";

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
          "/** Sets \`marginTop: "calc(var(--t-spacing) * 0)"\`. */
         get mt0() { return this.add("marginTop", "calc(var(--t-spacing) * 0)"); }",
          "/** Sets \`marginTop: "calc(var(--t-spacing) * 1)"\`. */
         get mt1() { return this.add("marginTop", "calc(var(--t-spacing) * 1)"); }",
          "/** Sets \`marginTop: "calc(var(--t-spacing) * 2)"\`. */
         get mt2() { return this.add("marginTop", "calc(var(--t-spacing) * 2)"); }",
          "/** Sets \`marginTop: "calc(var(--t-spacing) * 3)"\`. */
         get mt3() { return this.add("marginTop", "calc(var(--t-spacing) * 3)"); }",
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
          "/** Sets \`marginLeft: "calc(var(--t-spacing) * 0)"; marginRight: "calc(var(--t-spacing) * 0)"\`. */
         get mx0() { return this.add("marginLeft", "calc(var(--t-spacing) * 0)").add("marginRight", "calc(var(--t-spacing) * 0)"); }",
          "/** Sets \`marginLeft: "calc(var(--t-spacing) * 1)"; marginRight: "calc(var(--t-spacing) * 1)"\`. */
         get mx1() { return this.add("marginLeft", "calc(var(--t-spacing) * 1)").add("marginRight", "calc(var(--t-spacing) * 1)"); }",
          "/** Sets \`marginLeft: "calc(var(--t-spacing) * 2)"; marginRight: "calc(var(--t-spacing) * 2)"\`. */
         get mx2() { return this.add("marginLeft", "calc(var(--t-spacing) * 2)").add("marginRight", "calc(var(--t-spacing) * 2)"); }",
          "/** Sets \`marginLeft: "calc(var(--t-spacing) * 3)"; marginRight: "calc(var(--t-spacing) * 3)"\`. */
         get mx3() { return this.add("marginLeft", "calc(var(--t-spacing) * 3)").add("marginRight", "calc(var(--t-spacing) * 3)"); }",
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
            "/** Sets \`marginTop: "calc(var(--t-spacing) * 0)"; marginRight: "calc(var(--t-spacing) * 0)"; marginBottom: "calc(var(--t-spacing) * 0)"; marginLeft: "calc(var(--t-spacing) * 0)"\`. */
           get m0() { return this.add("marginTop", "calc(var(--t-spacing) * 0)").add("marginRight", "calc(var(--t-spacing) * 0)").add("marginBottom", "calc(var(--t-spacing) * 0)").add("marginLeft", "calc(var(--t-spacing) * 0)"); }",
            "/** Sets \`marginTop: "calc(var(--t-spacing) * 1)"; marginRight: "calc(var(--t-spacing) * 1)"; marginBottom: "calc(var(--t-spacing) * 1)"; marginLeft: "calc(var(--t-spacing) * 1)"\`. */
           get m1() { return this.add("marginTop", "calc(var(--t-spacing) * 1)").add("marginRight", "calc(var(--t-spacing) * 1)").add("marginBottom", "calc(var(--t-spacing) * 1)").add("marginLeft", "calc(var(--t-spacing) * 1)"); }",
            "/** Sets \`marginTop: "calc(var(--t-spacing) * 2)"; marginRight: "calc(var(--t-spacing) * 2)"; marginBottom: "calc(var(--t-spacing) * 2)"; marginLeft: "calc(var(--t-spacing) * 2)"\`. */
           get m2() { return this.add("marginTop", "calc(var(--t-spacing) * 2)").add("marginRight", "calc(var(--t-spacing) * 2)").add("marginBottom", "calc(var(--t-spacing) * 2)").add("marginLeft", "calc(var(--t-spacing) * 2)"); }",
            "/** Sets \`marginTop: "calc(var(--t-spacing) * 3)"; marginRight: "calc(var(--t-spacing) * 3)"; marginBottom: "calc(var(--t-spacing) * 3)"; marginLeft: "calc(var(--t-spacing) * 3)"\`. */
           get m3() { return this.add("marginTop", "calc(var(--t-spacing) * 3)").add("marginRight", "calc(var(--t-spacing) * 3)").add("marginBottom", "calc(var(--t-spacing) * 3)").add("marginLeft", "calc(var(--t-spacing) * 3)"); }",
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

  describe("newPxMethods", () => {
    it("creates a multi-property px method", () => {
      expect(newPxMethods("sq", ["height", "width"])).toMatchInlineSnapshot(`
        [
          "/** Sets \`height: px; width: px\`. */
         sqPx(px: number) { return this.add(\"height\", \`\${px}px\`).add(\"width\", \`\${px}px\`); }",
        ]
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
