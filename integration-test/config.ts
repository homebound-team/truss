// In theory this has most of the application-/theme-specific settings.
// Css.gen.ts pulls this in to know what to generate.

export const numberOfIncrements = 7;
export const increment = 8;

export const outputPath = "../src/Css.ts";

export enum Palette {
  // Functional
  Black = "#353535",
  MidGray = "#888888",
  LightGray = "#cecece",
  White = "#fcfcfa",
  Blue = "#526675",
  BlueFaded = "rgba(82, 102, 117, 0.3)",
  Hollow = "rgba(0, 0, 0, 0)",

  // Light
  LightBlue = "#D2D7DD",
  Gray = "#D1D2CD",
  Cream = "#FCFFF5",
  Peach = "#F7E9D5",
  Taupe = "#EBEAE4",

  // SaturatedColors
  Moss = "#B2B18C",
  Grass = "#657839",
  Orange = "#D17520",
  Wine = "#8B514E",
  Stone = "#A29983",

  // Bright
  BrightBlue = "#3A759D",
  BrightBlueFaded = "rgba(58, 117, 157, 0.1)",
  BrightGreen = "#AEB564",
  Yellow = "#F6B14E",
  Strawberry = "#C86251",
  StrawberryFaded = "rgba(200, 98, 81, 0.3)",
  Toast = "#CD9772",

  // error
  LightRed = "#e57373",
  Red = "#f44336",
  DarkRed = "#990000",

  // Blueprint
  PureBlack = "#000000",
  VeryLightGray = "#F1F1F1",
  Primary = "#0067c5",
  HoverAlphaChannel = "rgba(0, 0, 0, 0.045)",

  // Alert
  Error = "#ba4d40",
  Warning = "#f5e5cc",
  Info = "#e6e5de",
  Success = "#53662b",
}

export type FontDef = { abbr: string; px: number };
export const fonts: FontDef[] = [
  { abbr: "f108", px: 108 },
  { abbr: "f96", px: 96 },
  { abbr: "f72", px: 72 },
  { abbr: "f48", px: 48 },
  { abbr: "f32", px: 32 },
  { abbr: "f24", px: 24 },
  { abbr: "f18", px: 18 },
  { abbr: "f16", px: 16 },
  { abbr: "f14", px: 14 },
  { abbr: "f12", px: 12 },
  { abbr: "f10", px: 10 },
];

export const aliases: Record<string, string[]> = {
  bodyText: ["f14", "black"],
};

export const extras = `
export type Margin = "marginTop" | "marginBottom" | "marginLeft" | "marginRight";
`;
