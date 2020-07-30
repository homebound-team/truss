import { RuleFn } from "./RuleConfig";
import { makeRules } from "../utils";

// https://github.com/tachyons-css/tachyons/blob/master/src/_floats.css
export const floatRules: RuleFn = () =>
  makeRules("float", {
    fl: "left",
    fn: "none",
    fr: "right",
  });
