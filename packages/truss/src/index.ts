import { generate } from "src/generate";
import { defineConfig } from "src/config";
import {
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
import { defaultSections } from "src/sections/tachyons";

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

export default {
  defineConfig,
  defaultSections,
  generate,
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
};
