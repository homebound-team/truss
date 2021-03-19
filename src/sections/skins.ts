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

  const fillColors = newMethodsForProp(
    "fill",
    Object.fromEntries(
      Object.entries(palette).map(([key, value]) => [`f${key}`, value])
    )
  );

  return [
    ...colors,
    `color(value: string) { return this.add("color", value); }`,
    ...backgroundColors,
    `bgColor(value: string) { return this.add("backgroundColor", value); }`,
    ...fillColors,
    `fill(value: string) { return this.add("fill", value); }`,
  ];
};