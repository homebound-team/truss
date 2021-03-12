import { newMethod } from "../utils";
import { RuleFn } from "../config";

export const boxShadowRules: RuleFn = () => [
  newMethod("shadowNone", { boxShadow: "none" }),
];
