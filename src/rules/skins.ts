import { lowerCaseFirst, makeRules } from "../utils";
import { RuleFn } from "./RuleConfig";

export const skinRules: RuleFn = (config) => {
  const { palette } = config;

  const colors = makeRules(
    "color",
    Object.fromEntries(
      Object.entries(palette).map(([key, value]) => [
        lowerCaseFirst(key),
        value,
      ])
    )
  );

  const backgroundColors = makeRules(
    "backgroundColor",
    Object.fromEntries(
      Object.entries(palette).map(([key, value]) => [`bg${key}`, value])
    )
  );

  return [
    ...colors,
    `color(value: string) { return this.add("color", value); }`,
    ...backgroundColors,
    `bgColor(value: string) { return this.add("backgroundColor", value); }`,
    `fill(value: string) { return this.add("fill", value); }`,
  ];
};
