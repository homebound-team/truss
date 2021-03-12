import { RuleFn } from "../config";
import { makeRules } from "../utils";

// http://tachyons.io/docs/themes/borders/
// https://tailwindcss.com/docs/border-style/#app
export const borderStyleRules: RuleFn = () =>
  makeRules("borderStyle", {
    bsDashed: "dashed",
    bsDotted: "dotted",
    bsNone: "none",
    bsSolid: "solid",
  });
