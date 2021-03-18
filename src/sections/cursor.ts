import { newMethod, newMethodsForProp } from "../methods";
import { MethodFn } from "../config";

export const cursor: MethodFn = () => [
  ...newMethodsForProp("cursor", {
    cursorPointer: "pointer",
    cursorNotAllowed: "not-allowed",
  }),
];
