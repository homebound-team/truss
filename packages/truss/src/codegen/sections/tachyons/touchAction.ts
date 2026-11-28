import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
export const touchAction: CreateMethodsFn = () =>
  newMethodsForProp("touchAction", {
    touchNone: "none",
    touchPanY: "pan-y",
  });
