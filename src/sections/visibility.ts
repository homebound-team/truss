import { newMethodsForProp } from "../methods";
import { CreateMethodsFn } from "../config";

// https://tailwindcss.com/docs/visibility/
export const visibility: CreateMethodsFn = () =>
  newMethodsForProp("visibility", {
    visible: "visible",
    invisible: "hidden",
  });
