import { makeRule } from "../utils";
import { RuleFn } from "./RuleConfig";

export const typeScaleRules: RuleFn = ({ fonts }) =>
  Object.entries(fonts).map(([abbr, defs]) => {
    if (typeof defs === "string") {
      return makeRule(abbr, { fontSize: defs });
    }

    return makeRule(abbr, defs)
  })
