import { newMethod, newMethodsForProp } from "../methods";
import { CreateMethodsFn } from "../config";

export const cursor: CreateMethodsFn = () => [
  ...newMethodsForProp("cursor", {
    cursorPointer: "pointer",
    cursorNotAllowed: "not-allowed",
  }),
];
