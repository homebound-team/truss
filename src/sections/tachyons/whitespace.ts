import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const whitespace: CreateMethodsFn = () =>
  newMethodsForProp("whiteSpace", {
    nowrap: "nowrap",
    pre: "pre",
    wsNormal: "normal",
  });
