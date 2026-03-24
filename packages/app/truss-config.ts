import type { Aliases, FontConfig } from "@homebound/truss";
import { defineConfig } from "@homebound/truss";

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

const aliases: Aliases = {
  bodyText: ["f14", "black"],
};

export default defineConfig({
  outputPath: "./src/Css.ts",
  palette,
  fonts,
  increment,
  numberOfIncrements,
  aliases,
  breakpoints: { sm: 0, md: 600, lg: 960 },
  target: "stylex",
});
