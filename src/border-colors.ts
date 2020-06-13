import { Palette } from "./config";

const colors = Object.entries(Palette).map(([key, value]) => {
  return `get b${key}() { return this.add("borderColor", "${value}"); }`;
});

export const borderColorRules = colors;
