import { newMethod } from "../methods";
import { MethodFn } from "../config";

export const cursor: MethodFn = () => [
  newMethod("cursorPointer", { cursor: "pointer" }),
];
