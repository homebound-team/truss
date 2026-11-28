import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/list-style
export const listStyle: CreateMethodsFn = () =>
  newMethodsForProp("listStyle", {
    listNone: "none",
  });
