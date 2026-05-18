export * from "src/config";
export { defaultSections } from "src/sections/tachyons";
export { generate } from "src/generate";
export type { IncConfig, WebEntry } from "src/methods";
export { maybeCssVar } from "src/css-custom-property";
export {
  SPACING_CUSTOM_PROPERTY,
  incrementCssValue,
  rootSpacingPreludeCss,
  tryParseIncrementCalcMultiplier,
} from "src/spacing-css-var";
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
