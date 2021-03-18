import { MethodFn } from "../config";
import { newMethodsForProp, newParamMethod } from "../methods";

export const grid: MethodFn = () => [
  newParamMethod("gtc", "gridTemplateColumns"),
  newParamMethod("gtr", "gridTemplateRows"),
  newParamMethod("gap", "gap"),
];
