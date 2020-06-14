import { defaultRuleFns, generate, generateRules } from "../src";

const increment = 8;
const numberOfIncrements = 4;

const palette = {
  Black: "#353535",
  MidGray: "#888888",
  LightGray: "#cecece",
  White: "#fcfcfa",
  Blue: "#526675",
};

const fonts = {
  f24: "24px",
  f18: "18px",
  f16: "16px",
  f14: "14px",
  f12: "12px",
  f10: "10px",
};

const methods = generateRules(
  { palette, fonts, numberOfIncrements },
  defaultRuleFns
);

const aliases: Record<string, string[]> = {
  bodyText: ["f14", "black"],
};

const extras = [
  `
export type Margin = "marginTop" | "marginBottom" | "marginLeft" | "marginRight";
`,
];

generate({
  outputPath: "./integration-test/Css.ts",
  methods: Object.values(methods).flat(),
  increment,
  aliases,
  extras,
}).then(
  () => console.log("done"),
  (err) => console.error(err)
);
