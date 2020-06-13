import { inc } from "./spacing";

describe("spacing", () => {
  describe("inc", () => {
    it("can handle mt", () => {
      expect(inc("mt", "marginTop")).toMatchInlineSnapshot(`
        Array [
          "get mt0() { return this.mt(0); }",
          "get mt1() { return this.mt(1); }",
          "get mt2() { return this.mt(2); }",
          "get mt3() { return this.mt(3); }",
          "get mt4() { return this.mt(4); }",
          "get mt5() { return this.mt(5); }",
          "get mt6() { return this.mt(6); }",
          "get mt7() { return this.mt(7); }",
          "mt(inc: number | string) { return this.add(\\"marginTop\\", px(inc)); }",
        ]
      `);
    });

    it("can handle mx", () => {
      expect(inc("mx", ["ml", "mr"])).toMatchInlineSnapshot(`
        Array [
          "get mx0() { return this.mx(0); }",
          "get mx1() { return this.mx(1); }",
          "get mx2() { return this.mx(2); }",
          "get mx3() { return this.mx(3); }",
          "get mx4() { return this.mx(4); }",
          "get mx5() { return this.mx(5); }",
          "get mx6() { return this.mx(6); }",
          "get mx7() { return this.mx(7); }",
          "mx(inc: number | string) { return this.ml(inc).mr(inc); }",
        ]
      `);
    });

    it("can handle m", () => {
      expect(inc("m", ["mt", "mr", "mb", "ml"])).toMatchInlineSnapshot(`
        Array [
          "get m0() { return this.m(0); }",
          "get m1() { return this.m(1); }",
          "get m2() { return this.m(2); }",
          "get m3() { return this.m(3); }",
          "get m4() { return this.m(4); }",
          "get m5() { return this.m(5); }",
          "get m6() { return this.m(6); }",
          "get m7() { return this.m(7); }",
          "m(inc: number | string) { return this.mt(inc).mr(inc).mb(inc).ml(inc); }",
        ]
      `);
    });
  });
});
