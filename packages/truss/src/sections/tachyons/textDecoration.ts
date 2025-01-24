import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const textDecoration: CreateMethodsFn = () =>
  newMethodsForProp("textDecoration", {
    tdn: "none",
    tdlt: "line-through",
    tdu: "underline",
  });
