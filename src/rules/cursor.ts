import { makeRule } from "../utils";
import { RuleFn } from "./RuleConfig";

export const cursorRules: RuleFn = () => [
  makeRule("cursorRules", { cursor: "pointer" }),
];
