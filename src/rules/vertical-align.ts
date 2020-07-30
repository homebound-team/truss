import { RuleFn } from "./RuleConfig";
import { makeRules } from "../utils";

export const verticalAlignRules: RuleFn = () =>
  makeRules("verticalAlign", {
    vBase: "baseline",
    vMid: "middle",
    vTop: "top",
    vBottom: "bottom",
  });