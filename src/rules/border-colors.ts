import { RuleFn } from "./RuleConfig";
import { makeRules } from "../utils";

export const borderColorRules: RuleFn = ({palette}) => {
  const defs = Object.entries(palette).map(([key, value]) => [`b${key}`, value] as [string, string]);
  return makeRules("borderColor", defs);
}
