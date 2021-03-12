import { makeRules } from "../utils";
import { RuleFn } from "../config";

// https://tailwindcss.com/docs/visibility/
export const visibilityRules: RuleFn = () =>
  makeRules("visibility", {
    visible: "visible",
    invisible: "hidden",
  });
