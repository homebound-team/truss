import { generate, generateRules, makeRule } from "../src";

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

const fonts = {
  f24: "24px",
  f18: "18px",
  f16: "16px",
  f14: "14px",
  f12: "12px",
  f10: "10px",
};

const breakpoints = { sm: 0, md: 600, lg: 960 };

const methods = generateRules({ palette, fonts, numberOfIncrements });

// Add/remove application-specific/one-off rules as needed.
methods["custom-stuff"] = [makeRule("foo", { color: "#000000" })];

// You can also define common application-specific aliases.
const aliases: Record<string, string[]> = {
  bodyText: ["f14", "black"],
};

// Or just suffix random stuff at the bottom of the file.
const extras = [`export type CustomType = number;`];

generate({
  outputPath: "./integration-test/Css.ts",
  methods,
  increment,
  aliases,
  extras,
  breakpoints,
}).then(
  () => console.log("done"),
  (err) => console.error(err)
);
