import { newMethod } from "../methods";
import { MethodFn } from "../config";

export const boxShadow: MethodFn = () => [
  newMethod("shadowNone", { boxShadow: "none" }),
];
