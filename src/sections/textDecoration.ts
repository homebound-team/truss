import { newMethodsForProp } from "../methods";
import { MethodFn } from "../config";

export const textDecoration: MethodFn = () =>
  newMethodsForProp("textDecoration", {
    noUnderline: "none",
    strike: "line-through",
    underline: "underline",
  });
