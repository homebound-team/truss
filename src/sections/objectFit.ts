import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

// https://tailwindcss.com/docs/object-fit
export const objectFit: MethodFn = () =>
  newMethodsForProp(
    "objectFit",
    {
      objectContain: "contain",
      objectCover: "cover",
      objectFill: "fill",
      objectNone: "none",
      objectScaleDown: "scale-down",
    },
    "objectFit"
  );
