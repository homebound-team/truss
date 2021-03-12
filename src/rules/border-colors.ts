import { RuleFn } from "../config";
import { newMethodsForProp } from "../methods";

export const borderColorRules: RuleFn = ({ palette }) => {
  const defs = Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [`b${key}`, value])
  );
  return newMethodsForProp("borderColor", defs);
};
