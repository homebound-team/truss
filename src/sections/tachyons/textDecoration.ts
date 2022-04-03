import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const textDecoration: CreateMethodsFn = () =>
  newMethodsForProp("textDecoration", {
    noUnderline: "none",
    strike: "line-through",
    underline: "underline",
  });
