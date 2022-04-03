import { makeBreakpoints } from "src/breakpoints";

describe("breakpoints", () => {
  it("works with one breakpoint", () => {
    // this doesn't really make sense, but just make sure it doesn't blow up
    expect(makeBreakpoints({ sm: 0 })).toEqual({
      print: "@media print",
      sm: "@media screen and (max-width:0)",
    });
  });

  it("works with two breakpoints", () => {
    expect(makeBreakpoints({ sm: 0, lg: 600 })).toEqual({
      print: "@media print",
      sm: "@media screen and (max-width:599px)",
      lg: "@media screen and (min-width:600px)",
      smOrLg: "@media screen",
    });
  });

  it("works with three breakpoints", () => {
    expect(makeBreakpoints({ sm: 0, md: 600, lg: 960 })).toEqual({
      print: "@media print",
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
      print: "@media print",
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
