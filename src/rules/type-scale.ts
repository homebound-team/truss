import { newMethod } from "../utils";
import { RuleFn } from "../config";

export const typeScaleRules: RuleFn = ({ fonts }) =>
  Object.entries(fonts).map(([abbr, defs]) => {
    if (typeof defs === "string") {
      return newMethod(abbr, { fontSize: defs });
    }

    return newMethod(abbr, defs)
  })
