import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

export const borderColorRules: MethodFn = ({ palette }) => {
  const defs = Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [`b${key}`, value])
  );
  return newMethodsForProp("borderColor", defs);
};
