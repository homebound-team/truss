import { RuleFn } from "../config";
import { makeRules, makeIncRules } from "../utils";

// http://tachyons.io/docs/themes/borders/
export const borderWidthRules: RuleFn = () => [
  ...makeRules(
    "borderWidth",
    {
      bw1: "1px",
      bw2: "2px",
    },
    "bw"
  ),
];
