import { makeBreakpoints } from "src/breakpoints";
import { describe, expect, it } from "vitest";

describe("breakpoints", () => {
  it("works with one breakpoint", () => {
    // this doesn't really make sense, but just make sure it doesn't blow up
    expect(makeBreakpoints({ sm: 0 })).toEqual({
      print: "@media print",
      sm: "@media (max-width: 0)",
    });
  });

  it("works with two breakpoints", () => {
    expect(makeBreakpoints({ sm: 0, lg: 600 })).toEqual({
      print: "@media print",
      sm: "@media (max-width: 599px)",
      lg: "@media (min-width: 600px)",
      smOrLg: "@media ",
    });
  });

  it("works with three breakpoints", () => {
    expect(makeBreakpoints({ sm: 0, md: 600, lg: 960 })).toEqual({
      print: "@media print",
      sm: "@media (max-width: 599px)",
      md: "@media (min-width: 600px) and (max-width: 959px)",
      lg: "@media (min-width: 960px)",
      smOrMd: "@media (max-width: 959px)",
      mdOrLg: "@media (min-width: 600px)",
      mdAndUp: "@media (min-width: 600px)",
      mdAndDown: "@media (max-width: 959px)",
    });
  });

  it("works with four breakpoints", () => {
    expect(makeBreakpoints({ sm: 0, md: 600, lg: 960, xl: 1200 })).toEqual({
      print: "@media print",
      sm: "@media (max-width: 599px)",
      md: "@media (min-width: 600px) and (max-width: 959px)",
      lg: "@media (min-width: 960px) and (max-width: 1199px)",
      xl: "@media (min-width: 1200px)",
      smOrMd: "@media (max-width: 959px)",
      mdOrLg: "@media (min-width: 600px) and (max-width: 1199px)",
      lgOrXl: "@media (min-width: 960px)",
      mdAndUp: "@media (min-width: 600px)",
      mdAndDown: "@media (max-width: 959px)",
      lgAndUp: "@media (min-width: 960px)",
      lgAndDown: "@media (max-width: 1199px)",
    });
  });
});
