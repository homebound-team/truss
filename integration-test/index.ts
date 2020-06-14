import { defaultRuleFns, generate, generateRules } from "../src";

const increment = 8;
const numberOfIncrements = 7;

const palette = {
  // Functional
  Black: "#353535",
  MidGray: "#888888",
  LightGray: "#cecece",
  White: "#fcfcfa",
  Blue: "#526675",
  BlueFaded: "rgba(82, 102, 117, 0.3)",
  Hollow: "rgba(0, 0, 0, 0)",

  // Light
  LightBlue: "#D2D7DD",
  Gray: "#D1D2CD",
  Cream: "#FCFFF5",
  Peach: "#F7E9D5",
  Taupe: "#EBEAE4",

  // SaturatedColors
  Moss: "#B2B18C",
  Grass: "#657839",
  Orange: "#D17520",
  Wine: "#8B514E",
  Stone: "#A29983",

  // Bright
  BrightBlue: "#3A759D",
  BrightBlueFaded: "rgba(58, 117, 157, 0.1)",
  BrightGreen: "#AEB564",
  Yellow: "#F6B14E",
  Strawberry: "#C86251",
  StrawberryFaded: "rgba(200, 98, 81, 0.3)",
  Toast: "#CD9772",

  // error
  LightRed: "#e57373",
  Red: "#f44336",
  DarkRed: "#990000",

  // Blueprint
  PureBlack: "#000000",
  VeryLightGray: "#F1F1F1",
  Primary: "#0067c5",
  HoverAlphaChannel: "rgba(0, 0, 0, 0.045)",

  // Alert
  Error: "#ba4d40",
  Warning: "#f5e5cc",
  Info: "#e6e5de",
  Success: "#53662b",
};

const fonts = {
  f108: "108px",
  f96: "96px",
  f72: "72px",
  f48: "48px",
  f32: "32px",
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
