export * from "src/config";
export { defaultSections } from "src/sections/tachyons";
export { generate } from "src/generate";
export type { IncConfig, WebEntry } from "src/methods";
export { TRUSS_SPACING_CUSTOM_PROPERTY, trussWebIncrementCssValue, trussWebRootSpacingPreludeCss, trussWebTryParseIncrementCalcMultiplier } from "src/spacing-css-var";
export {
  newAliasesMethods,
  newMethod,
  newPxMethod,
  newMethodsForProp,
  newCoreIncrementMethods,
  newIncrementMethods,
  newParamMethod,
  newSetCssVariablesMethod,
  startWebCollection,
  stopWebCollection,
} from "src/methods";
