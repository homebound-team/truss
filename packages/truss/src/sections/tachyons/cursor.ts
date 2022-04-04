import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const cursor: CreateMethodsFn = () => [
  ...newMethodsForProp("cursor", {
    cursorPointer: "pointer",
    cursorNotAllowed: "not-allowed",
  }),
];
