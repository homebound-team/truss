import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

export const outline: CreateMethodsFn = () =>
  newMethodsForProp("outline", {
    outline1: "1px solid",
    outlineTransparent: "1px solid transparent",
    outline0: "0",
  });
