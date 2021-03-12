import { RuleFn } from "../config";
import { newMethodsForProp } from "../methods";

export const outlineRules: RuleFn = () =>
  newMethodsForProp("outline", {
    outline: "1px solid",
    outlineTransparent: "1px solid transparent",
    outline0: "0",
  });
