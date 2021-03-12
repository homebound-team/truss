import { newMethod } from "../methods";
import { RuleFn } from "../config";

export const cursorRules: RuleFn = () => [
  newMethod("cursorPointer", { cursor: "pointer" }),
];
