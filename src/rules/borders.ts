import { makeRule } from "../utils";
import { RuleFn } from "./RuleConfig";

const borderDefs: [string, [string, string]][] = [
  ["ba", ["borderStyle", "borderWidth"]],
  ["bt", ["borderTopStyle", "borderTopWidth"]],
  ["br", ["borderRightStyle", "borderRightWidth"]],
  ["bb", ["borderBottomStyle", "borderBottomWidth"]],
  ["bl", ["borderLeftStyle", "borderLeftWidth"]],
];

export const borderRules: RuleFn = () => [
  ...borderDefs.map(([abbr, [style, width]]) => {
    return makeRule(abbr, { [style]: "solid", [width]: "1px" });
  }),
  makeRule("bn", { borderStyle: "none", borderWidth: "0" }),
];
