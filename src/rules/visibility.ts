import { newMethodsForProp } from "../methods";
import { RuleFn } from "../config";

// https://tailwindcss.com/docs/visibility/
export const visibilityRules: RuleFn = () =>
  newMethodsForProp("visibility", {
    visible: "visible",
    invisible: "hidden",
  });
