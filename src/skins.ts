import { Palette } from "./config";
import { lowerCaseFirst } from "./utils";

const colors = Object.entries(Palette).map(([key, value]) => {
  return `get ${lowerCaseFirst(key)}() { return this.add("color", "${value}"); }`;
});

const backgroundColors = Object.entries(Palette).map(([key, value]) => {
  return `get bg${key}() { return this.add("backgroundColor", "${value}"); }`;
});

export const skinRules = [
  ...colors,
  `color(value: string) { return this.add("color", value); }`,
  "",
  ...backgroundColors,
  `bgColor(value: string) { return this.add("backgroundColor", value); }`,
  "",
];
