import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

export const borderColor: CreateMethodsFn = ({ palette }) => {
  const defs = Object.fromEntries(Object.entries(palette).map(([key, value]) => [`bc${key}`, value]));
  return newMethodsForProp("borderColor", defs, "bc");
};
