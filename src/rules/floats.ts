import { RuleFn } from "./RuleConfig";
import { makeRules } from "../utils";

export const floatRules: RuleFn = () =>
  makeRules("float", {
    fl: "left",
    fn: "none",
    fr: "right",
  });
