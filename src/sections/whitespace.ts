import { newMethodsForProp } from "../methods";
import { MethodFn } from "../config";

export const whitespace: MethodFn = () =>
  newMethodsForProp("whiteSpace", {
    nowrap: "nowrap",
    pre: "pre",
    wsNormal: "normal",
  });
