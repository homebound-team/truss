import { makeRules } from "../utils";
import { RuleFn } from "../config";

// https://tailwindcss.com/docs/user-select/
export const userSelectRules: RuleFn = () =>
  makeRules("userSelect", {
    selectNone: "none",
    selectText: "text",
    selectAll: "all",
    selectAuto: "auto",
  });
