import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/appearance
export const appearance: CreateMethodsFn = () =>
  newMethodsForProp("appearance", {
    appearanceNone: "none",
  });
