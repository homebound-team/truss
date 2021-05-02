import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

export const outline: MethodFn = () =>
  newMethodsForProp("outline", {
    outline1: "1px solid",
    outlineTransparent: "1px solid transparent",
    outline0: "0",
  });
