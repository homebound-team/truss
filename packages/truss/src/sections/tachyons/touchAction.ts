import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
export const touchAction: CreateMethodsFn = () =>
  newMethodsForProp("touchAction", {
    touchNone: "none",
    touchPanY: "pan-y",
  });
