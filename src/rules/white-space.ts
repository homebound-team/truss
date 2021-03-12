import { newMethodsForProp } from "../utils";
import { RuleFn } from "../config";

export const whitespaceRules: RuleFn = () =>
  newMethodsForProp("whiteSpace", {
    nowrap: "nowrap",
    pre: "pre",
    wsNormal: "normal",
  });
