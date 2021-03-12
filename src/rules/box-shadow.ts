import { makeRule } from "../utils";
import { RuleFn } from "../config";

export const boxShadowRules: RuleFn = () => [
  makeRule("shadowNone", { boxShadow: "none" }),
];
