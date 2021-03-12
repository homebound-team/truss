import { newMethod } from "../utils";
import { RuleFn } from "../config";

export const cursorRules: RuleFn = () => [
  newMethod("cursorPointer", { cursor: "pointer" }),
];
