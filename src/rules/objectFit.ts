import { RuleFn } from "../config";
import { newMethodsForProp } from "../utils";

// https://tailwindcss.com/docs/object-fit
export const objectFitRules: RuleFn = () =>
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
