import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";
import { lowerCaseFirst } from "../utils";

export const skins: MethodFn = (config) => {
  const { palette } = config;

  const colors = newMethodsForProp(
    "color",
    Object.fromEntries(
      Object.entries(palette).map(([key, value]) => [
        lowerCaseFirst(key),
        value,
      ])
    )
  );

  const backgroundColors = newMethodsForProp(
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
