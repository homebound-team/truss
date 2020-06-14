import { makeRule } from "../utils";
import { RuleFn } from "./RuleConfig";

export const boxShadowRules: RuleFn = () => [
  makeRule("shadowNone", { boxShadow: "none" }),
];
