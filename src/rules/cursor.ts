import { newMethod } from "../methods";
import { MethodFn } from "../config";

export const cursorRules: MethodFn = () => [
  newMethod("cursorPointer", { cursor: "pointer" }),
];
