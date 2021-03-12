import { newMethodsForProp } from "../utils";
import { RuleFn } from "../config";

// https://tailwindcss.com/docs/visibility/
export const visibilityRules: RuleFn = () =>
  newMethodsForProp("visibility", {
    visible: "visible",
    invisible: "hidden",
  });
