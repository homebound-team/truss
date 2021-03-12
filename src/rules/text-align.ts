import { newMethodsForProp } from "../utils";
import { RuleFn } from "../config";

// https://github.com/tachyons-css/tachyons/blob/master/src/_text-align.css
export const textAlignRules: RuleFn = () =>
  newMethodsForProp("textAlign", {
    tl: "left",
    tc: "center",
    tr: "right",
    tj: "justify",
  });
