import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://tailwindcss.com/docs/object-fit
export const objectFit: CreateMethodsFn = () =>
  newMethodsForProp("objectFit", {
    objectContain: "contain",
    objectCover: "cover",
    objectFill: "fill",
    objectNone: "none",
    objectScaleDown: "scale-down",
  });
