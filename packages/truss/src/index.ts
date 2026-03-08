import { generate } from "src/generate";

export * from "src/config";
export { defaultSections } from "src/sections/tachyons";
export { generate } from "src/generate";
export type { IncConfig, StylexEntry } from "src/methods";
export {
  newAliasesMethods,
  newMethod,
  newPxMethod,
  newMethodsForProp,
  newCoreIncrementMethods,
  newIncrementMethods,
  newParamMethod,
  newSetCssVariablesMethod,
  startStylexCollection,
  stopStylexCollection,
} from "src/methods";
