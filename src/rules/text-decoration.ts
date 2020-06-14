import { makeRules } from "../utils";
import { RuleFn } from "./RuleConfig";

export const textDecorationRules: RuleFn = () =>
  makeRules("textDecoration", [
    ["noUnderline", "none"],
    ["strike", "line-through"],
    ["underline", "underline"],
  ]);
