import { newMethodsForProp } from "../methods";
import { MethodFn } from "../config";

// https://tailwindcss.com/docs/visibility/
export const visibilityRules: MethodFn = () =>
  newMethodsForProp("visibility", {
    visible: "visible",
    invisible: "hidden",
  });
