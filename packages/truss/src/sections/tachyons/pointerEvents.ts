import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
export const pointerEvents: CreateMethodsFn = () =>
  newMethodsForProp("pointerEvents", {
    pen: "none",
    pea: "auto",
  });
