import { RuleFn } from "./RuleConfig";
import { makeRules } from "../utils";

// http://tachyons.io/docs/themes/borders/
export const borderStyleRules: RuleFn = () =>
  makeRules("borderStyle", {
    b__dashed: "dashed",
    b__dotted: "dotted",
  });
