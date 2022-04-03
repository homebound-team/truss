import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";
import { lowerCaseFirst } from "src/utils";

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
