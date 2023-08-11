import { Aliases, defineConfig, FontConfig, newMethod, newSetCssVariablesMethod } from "@homebound/truss";

const increment = 8;
const numberOfIncrements = 4;

const palette = {
  Black: "#353535",
  MidGray: "#888888",
  LightGray: "#cecece",
  White: "#fcfcfa",
  Blue: "#526675",
  Primary: "var(--primary)",
};

const fonts: FontConfig = {
  f24: "24px",
  f18: "18px",
  f16: "16px",
  f14: "14px",
  f12: "12px",
  f10: { fontSize: "10px", fontWeight: 500 },
};

const breakpoints = { sm: 0, md: 600, lg: 960 };

// Add/remove application-specific/one-off rules as needed.
const sections = {
  customStuff: () => [newMethod("foo", { color: "#000000" })],

  // Create a rule that sets a CSS variable.
  vars: () => [newSetCssVariablesMethod("darkMode", { "--primary": "#000000" })],
};

// You can also define common application-specific aliases.
const aliases: Aliases = {
  // bodyText: ["f14", "black"],
};

// Or just suffix random stuff at the bottom of the file.
const extras = [`export type CustomType = number;`];

export default defineConfig({
  defaultMethods: "tachyons-rn",
  outputPath: "./src/Css.ts",
  palette,
  fonts,
  increment,
  numberOfIncrements,
  aliases,
  extras,
  breakpoints,
  sections,
});
