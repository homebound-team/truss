import { RuleFn } from "../config";
import { newMethodsForProp, newIncrementMethods } from "../methods";

// http://tachyons.io/docs/themes/borders/
export const borderWidthRules: RuleFn = () => [
  ...newMethodsForProp(
    "borderWidth",
    {
      bw1: "1px",
      bw2: "2px",
    },
    "bw"
  ),
];
