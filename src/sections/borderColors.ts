import { CreateMethodsFn } from "../config";
import { newMethodsForProp } from "../methods";

export const borderColor: CreateMethodsFn = ({ palette }) => {
  const defs = Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [`b${key}`, value])
  );
  return newMethodsForProp("borderColor", defs, "bc");
};
