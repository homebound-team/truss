import {
  Aliases,
  FontConfig,
  generate,
  newSetCssVariablesMethod,
  newMethod,
} from "../src";

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
  vars: () => [
    newSetCssVariablesMethod("setVars", { "--primary": "#000000" }),
    newMethod("var", { color: "var(--primary)" }),
  ],
};

// You can also define common application-specific aliases.
const aliases: Aliases = {
  bodyText: ["f14", "black"],
};

// Or just suffix random stuff at the bottom of the file.
const extras = [`export type CustomType = number;`];

generate({
  outputPath: "./integration-test/Css.ts",
  palette,
  fonts,
  increment,
  numberOfIncrements,
  aliases,
  extras,
  breakpoints,
  sections,
}).then(
  () => console.log("done"),
  (err) => console.error(err)
);
