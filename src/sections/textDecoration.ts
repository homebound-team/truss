import { newMethodsForProp } from "../methods";
import { CreateMethodsFn } from "../config";

export const textDecoration: CreateMethodsFn = () =>
  newMethodsForProp("textDecoration", {
    noUnderline: "none",
    strike: "line-through",
    underline: "underline",
  });
