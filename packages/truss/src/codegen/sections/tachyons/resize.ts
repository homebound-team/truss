import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/resize
export const resize: CreateMethodsFn = () =>
  newMethodsForProp("resize", {
    resizeNone: "none",
  });
