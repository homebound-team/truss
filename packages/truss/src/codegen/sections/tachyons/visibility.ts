import { newMethodsForProp } from "src/codegen/methods";
import { CreateMethodsFn } from "src/codegen/config";

// https://tailwindcss.com/docs/visibility/
export const visibility: CreateMethodsFn = () =>
  newMethodsForProp("visibility", {
    vv: "visible",
    vh: "hidden",
  });
