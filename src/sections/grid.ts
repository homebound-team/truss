import { MethodFn } from "../config";
import {
  newIncrementMethods,
  newMethodsForProp,
  newParamMethod,
} from "../methods";

export const grid: MethodFn = (config) => [
  newParamMethod("gtc", "gridTemplateColumns"),
  newParamMethod("gtr", "gridTemplateRows"),
  ...newIncrementMethods(config, "gap", "gap"),
];
