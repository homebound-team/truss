import { RuleFn } from "../config";
import { makeRules } from "../utils";

// https://tailwindcss.com/docs/object-fit
export const objectFitRules: RuleFn = () =>
  makeRules(
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
