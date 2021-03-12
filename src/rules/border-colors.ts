import { RuleFn } from "./TrussConfig";
import { makeRules } from "../utils";

export const borderColorRules: RuleFn = ({ palette }) => {
  const defs = Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [`b${key}`, value])
  );
  return makeRules("borderColor", defs);
};
