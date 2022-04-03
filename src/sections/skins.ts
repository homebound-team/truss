import { CreateMethodsFn } from "../config";
import { newMethodsForProp } from "../methods";
import { lowerCaseFirst } from "../utils";

export const skins: CreateMethodsFn = (config) => {
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
    ),
    "bgColor"
  );

  const fillColors = newMethodsForProp(
    "fill",
    Object.fromEntries(
      Object.entries(palette).map(([key, value]) => [`f${key}`, value])
    )
  );

  return [...colors, ...backgroundColors, ...fillColors];
};
