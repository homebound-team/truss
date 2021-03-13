import { newMethod } from "../methods";
import { MethodFn } from "../config";

export const boxShadowRules: MethodFn = () => [
  newMethod("shadowNone", { boxShadow: "none" }),
];
