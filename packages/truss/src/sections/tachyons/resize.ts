import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/resize
export const resize: CreateMethodsFn = () =>
  newMethodsForProp("resize", {
    resizeNone: "none",
  });
