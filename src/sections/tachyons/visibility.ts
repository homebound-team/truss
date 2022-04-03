import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

// https://tailwindcss.com/docs/visibility/
export const visibility: CreateMethodsFn = () =>
  newMethodsForProp("visibility", {
    visible: "visible",
    invisible: "hidden",
  });
