import { RuleFn } from "../config";
import { newMethodsForProp } from "../utils";

// http://tachyons.io/docs/themes/borders/
// https://tailwindcss.com/docs/border-style/#app
export const borderStyleRules: RuleFn = () =>
  newMethodsForProp("borderStyle", {
    bsDashed: "dashed",
    bsDotted: "dotted",
    bsNone: "none",
    bsSolid: "solid",
  });
