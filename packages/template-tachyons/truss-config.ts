import { Aliases, defineConfig, FontConfig, newMethod } from "@homebound/truss";

// Defines the px value of abbreviations. e.g `mt1` will be `marginTop: 6px`.
const increment = 6;

// Defines how many increment abbreviations to generate, e.g. `mt0`, `mt1`, ...
const numberOfIncrements = 7;

// Defines the typeface abbreviations, the keys can be whatever you want
const fonts: FontConfig = {
  f10: "10px",
  f12: "12px",
  f14: "14px",
  f24: "24px",
  // Besides the "24px" shorthand, you can define weight+size+lineHeight tuples
  tiny: { fontWeight: 400, fontSize: "10px", lineHeight: "14px" },
};

// Defines color abbreviations, e.g. `Css.bgBlack.$`, the keys can be whatever you want
const palette = {
  Black: "#353535",
  MidGray: "#888888",
  LightGray: "#cecece",
  White: "#fcfcfa",
  Blue: "#526675",
  BlueFaded: "rgba(82, 102, 117, 0.3)",
  Hollow: "rgba(0, 0, 0, 0)",
};

// You can add/remove your own application-specific/one-off rules as needed.
const sections = {
  customStuff: () => [newMethod("foo", { color: "#000000" })],
};

// Defines common application-specific aliases of abbreviation -> N other abbreviations
const aliases: Aliases = {
  bodyText: ["f14", "black"],
};

// Defines breakpoints that create `sm`, `md`, `mdAndUp`, `mdOrLg`, etc. media query consts
const breakpoints = { sm: 0, md: 600, lg: 960 };

export default defineConfig({
  outputPath: "./src/Css.ts",
  palette,
  fonts,
  increment,
  numberOfIncrements,
  aliases,
  breakpoints,
  sections,
});
