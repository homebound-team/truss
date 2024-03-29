import { CreateMethodsFn } from "src/config";
import { newIncrementMethods, newParamMethod } from "src/methods";

export const grid: CreateMethodsFn = (config) => [
  newParamMethod("gtc", "gridTemplateColumns"),
  newParamMethod("gtr", "gridTemplateRows"),
  newParamMethod("gr", "gridRow"),
  newParamMethod("gc", "gridColumn"),
  newParamMethod("gar", "gridAutoRows"),
  newParamMethod("gac", "gridAutoColumns"),
  ...newIncrementMethods(config, "gap", "gap"),
  ...newIncrementMethods(config, "rg", "rowGap"),
  ...newIncrementMethods(config, "cg", "columnGap"),
];
