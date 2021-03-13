import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

// http://tachyons.io/docs/themes/borders/
// https://tailwindcss.com/docs/border-style/#app
export const borderStyleRules: MethodFn = () =>
  newMethodsForProp("borderStyle", {
    bsDashed: "dashed",
    bsDotted: "dotted",
    bsNone: "none",
    bsSolid: "solid",
  });
