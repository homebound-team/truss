import { newMethod } from "../methods";
import { RuleFn } from "../config";

export const boxShadowRules: RuleFn = () => [
  newMethod("shadowNone", { boxShadow: "none" }),
];
