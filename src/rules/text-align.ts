import { makeRules } from "../utils";
import { RuleFn } from "./TrussConfig";

// https://github.com/tachyons-css/tachyons/blob/master/src/_text-align.css
export const textAlignRules: RuleFn = () =>
  makeRules("textAlign", {
    tl: "left",
    tc: "center",
    tr: "right",
    tj: "justify",
  });
