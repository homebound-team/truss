import { newMethodsForProp } from "../utils";
import { RuleFn } from "../config";

export const textDecorationRules: RuleFn = () =>
  newMethodsForProp("textDecoration", {
    noUnderline: "none",
    strike: "line-through",
    underline: "underline",
  });
