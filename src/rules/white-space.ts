import { makeRules } from "../utils";
import { RuleFn } from "../config";

export const whitespaceRules: RuleFn = () =>
  makeRules("whiteSpace", {
    nowrap: "nowrap",
    pre: "pre",
    wsNormal: "normal",
  });
