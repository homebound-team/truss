import { newMethodsForProp } from "../methods";
import { CreateMethodsFn } from "../config";

export const whitespace: CreateMethodsFn = () =>
  newMethodsForProp("whiteSpace", {
    nowrap: "nowrap",
    pre: "pre",
    wsNormal: "normal",
  });
