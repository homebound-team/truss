import { makeRules } from "../utils";
import { RuleFn } from "./RuleConfig";

// https://tailwindcss.com/docs/user-select/
export const userSelectRules: RuleFn = () =>
  makeRules("userSelect", {
    selectNote: "none",
    selectText: "text",
    selectAll: "all",
    selectAuto: "auto",
  });
