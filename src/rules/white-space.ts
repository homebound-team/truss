import { newMethodsForProp } from "../methods";
import { MethodFn } from "../config";

export const whitespaceRules: MethodFn = () =>
  newMethodsForProp("whiteSpace", {
    nowrap: "nowrap",
    pre: "pre",
    wsNormal: "normal",
  });
