import { CreateMethodsFn } from "../config";
import {
  newIncrementMethods,
  newMethodsForProp,
  newParamMethod,
} from "../methods";

export const grid: CreateMethodsFn = (config) => [
  newParamMethod("gtc", "gridTemplateColumns"),
  newParamMethod("gtr", "gridTemplateRows"),
  newParamMethod("gr", "gridRow"),
  newParamMethod("gc", "gridColumn"),
  ...newIncrementMethods(config, "gap", "gap"),
  ...newIncrementMethods(config, "rg", "rowGap"),
  ...newIncrementMethods(config, "cg", "columnGap"),
];
