import { newMethodsForProp } from "src/codegen/methods";
import { CreateMethodsFn } from "src/codegen/config";

export const cursor: CreateMethodsFn = () => [
  ...newMethodsForProp("cursor", {
    cursorPointer: "pointer",
    cursorNotAllowed: "not-allowed",
  }),
];
