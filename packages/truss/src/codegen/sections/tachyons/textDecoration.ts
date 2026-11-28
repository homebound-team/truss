import { newMethodsForProp } from "src/codegen/methods";
import { CreateMethodsFn } from "src/codegen/config";

export const textDecoration: CreateMethodsFn = () =>
  newMethodsForProp("textDecoration", {
    tdn: "none",
    tdlt: "line-through",
    tdu: "underline",
  });
