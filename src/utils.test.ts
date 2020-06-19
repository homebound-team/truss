import { RuleConfig } from "./rules";
import { makeBreakpoints, makeIncRules } from "./utils";

describe("utils", () => {
  const config: RuleConfig = { numberOfIncrements: 3, fonts: {}, palette: {} };

  describe("makeIncRules", () => {
    it("can handle mt", () => {
      expect(makeIncRules(config, "mt", "marginTop")).toMatchInlineSnapshot(`
        Array [
          "get mt0() { return this.mt(0); }",
          "get mt1() { return this.mt(1); }",
          "get mt2() { return this.mt(2); }",
          "get mt3() { return this.mt(3); }",
          "mt(inc: number | string) { return this.add(\\"marginTop\\", px(inc)); }",
        ]
      `);
    });

    it("can handle mx", () => {
      expect(makeIncRules(config, "mx", ["ml", "mr"])).toMatchInlineSnapshot(`
        Array [
          "get mx0() { return this.mx(0); }",
          "get mx1() { return this.mx(1); }",
          "get mx2() { return this.mx(2); }",
          "get mx3() { return this.mx(3); }",
          "mx(inc: number | string) { return this.ml(inc).mr(inc); }",
        ]
      `);
    });

    it("can handle m", () => {
      expect(makeIncRules(config, "m", ["mt", "mr", "mb", "ml"]))
        .toMatchInlineSnapshot(`
        Array [
          "get m0() { return this.m(0); }",
          "get m1() { return this.m(1); }",
          "get m2() { return this.m(2); }",
          "get m3() { return this.m(3); }",
          "m(inc: number | string) { return this.mt(inc).mr(inc).mb(inc).ml(inc); }",
        ]
      `);
    });
  });

  describe("makeBreakpoints", () => {
    it("works with one breakpoint", () => {
      // this doesn't really make sense, but just make sure it doesn't blow up
      expect(makeBreakpoints({ sm: 0 })).toEqual({
        sm: "@media screen and (max-width:0)",
      });
    });

    it("works with two breakpoints", () => {
      expect(makeBreakpoints({ sm: 0, lg: 600 })).toEqual({
        sm: "@media screen and (max-width:599px)",
        lg: "@media screen and (min-width:600px)",
        smOrLg: "@media screen",
      });
    });

    it("works with three breakpoints", () => {
      expect(makeBreakpoints({ sm: 0, md: 600, lg: 960 })).toEqual({
        sm: "@media screen and (max-width:599px)",
        md: "@media screen and (min-width:600px) and (max-width:959px)",
        lg: "@media screen and (min-width:960px)",
        smOrMd: "@media screen and (max-width:959px)",
        mdOrLg: "@media screen and (min-width:600px)",
        mdAndUp: "@media screen and (min-width:600px)",
        mdAndDown: "@media screen and (max-width:959px)",
      });
    });

    it("works with four breakpoints", () => {
      expect(makeBreakpoints({ sm: 0, md: 600, lg: 960, xl: 1200 })).toEqual({
        sm: "@media screen and (max-width:599px)",
        md: "@media screen and (min-width:600px) and (max-width:959px)",
        lg: "@media screen and (min-width:960px) and (max-width:1199px)",
        xl: "@media screen and (min-width:1200px)",
        smOrMd: "@media screen and (max-width:959px)",
        mdOrLg: "@media screen and (min-width:600px) and (max-width:1199px)",
        lgOrXl: "@media screen and (min-width:960px)",
        mdAndUp: "@media screen and (min-width:600px)",
        mdAndDown: "@media screen and (max-width:959px)",
        lgAndUp: "@media screen and (min-width:960px)",
        lgAndDown: "@media screen and (max-width:1199px)",
      });
    });
  });
});
