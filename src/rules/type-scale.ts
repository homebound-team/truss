import { makeRules } from "../utils";
import { RuleFn } from "./RuleConfig";

export const typeScaleRules: RuleFn = (config) =>
  makeRules("fontSize", config.fonts);
