import { CreateMethodsFn } from "src/codegen/config";
import { newIncrementMethods, newParamMethod } from "src/codegen/methods";

export const grid: CreateMethodsFn = (config) => [
  newParamMethod("gtc", "gridTemplateColumns"),
  newParamMethod("gtr", "gridTemplateRows"),
  newParamMethod("gr", "gridRow"),
  newParamMethod("gc", "gridColumn"),
  newParamMethod("ga", "gridArea"),
  newParamMethod("gar", "gridAutoRows"),
  newParamMethod("gac", "gridAutoColumns"),
  ...newIncrementMethods(config, "gap", "gap"),
  ...newIncrementMethods(config, "rg", "rowGap"),
  ...newIncrementMethods(config, "cg", "columnGap"),
];
