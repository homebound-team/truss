import { newMethod } from "../utils";
import { RuleFn } from "../config";

const borderDefs: [string, [string, string]][] = [
  ["ba", ["borderStyle", "borderWidth"]],
  ["bt", ["borderTopStyle", "borderTopWidth"]],
  ["br", ["borderRightStyle", "borderRightWidth"]],
  ["bb", ["borderBottomStyle", "borderBottomWidth"]],
  ["bl", ["borderLeftStyle", "borderLeftWidth"]],
];

export const borderRules: RuleFn = () => [
  ...borderDefs.map(([abbr, [style, width]]) => {
    return newMethod(abbr, { [style]: "solid", [width]: "1px" });
  }),
  newMethod("bn", { borderStyle: "none", borderWidth: "0" }),
];
