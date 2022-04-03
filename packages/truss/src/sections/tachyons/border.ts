import { newMethod } from "src/methods";
import { CreateMethodsFn } from "src/config";

const borderDefs: [string, [string, string]][] = [
  ["ba", ["borderStyle", "borderWidth"]],
  ["bt", ["borderTopStyle", "borderTopWidth"]],
  ["br", ["borderRightStyle", "borderRightWidth"]],
  ["bb", ["borderBottomStyle", "borderBottomWidth"]],
  ["bl", ["borderLeftStyle", "borderLeftWidth"]],
];

export const border: CreateMethodsFn = () => [
  ...borderDefs.map(([abbr, [style, width]]) => {
    return newMethod(abbr, { [style]: "solid", [width]: "1px" });
  }),
  newMethod("bn", { borderStyle: "none", borderWidth: "0" }),
];
