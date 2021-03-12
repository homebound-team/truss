import { makeRule } from "../utils";
import { RuleFn } from "./TrussConfig";

export const cursorRules: RuleFn = () => [
  makeRule("cursorPointer", { cursor: "pointer" }),
];
