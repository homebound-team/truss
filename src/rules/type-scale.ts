import { makeRule } from "../utils";
import { RuleFn } from "../config";

export const typeScaleRules: RuleFn = ({ fonts }) =>
  Object.entries(fonts).map(([abbr, defs]) => {
    if (typeof defs === "string") {
      return makeRule(abbr, { fontSize: defs });
    }

    return makeRule(abbr, defs)
  })
