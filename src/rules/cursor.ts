import { makeRule } from "../utils";
import { RuleFn } from "../config";

export const cursorRules: RuleFn = () => [
  makeRule("cursorPointer", { cursor: "pointer" }),
];
