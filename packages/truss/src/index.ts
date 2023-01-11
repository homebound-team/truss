import { generate } from "src/generate";

export * from "src/config";
export { defaultSections } from "src/sections/tachyons";
export { generate } from "src/generate";
export type { IncConfig } from "src/methods";
export {
  newAliasesMethods,
  newMethod,
  newMethodsForProp,
  newCoreIncrementMethods,
  newIncrementMethods,
  newParamMethod,
  newSetCssVariablesMethod,
} from "src/methods";
