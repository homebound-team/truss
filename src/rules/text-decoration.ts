import { makeRules } from "../utils";
import { RuleFn } from "../config";

export const textDecorationRules: RuleFn = () =>
  makeRules("textDecoration", {
    noUnderline: "none",
    strike: "line-through",
    underline: "underline",
  });
