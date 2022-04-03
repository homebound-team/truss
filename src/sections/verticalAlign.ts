import { CreateMethodsFn } from "../config";
import { newMethodsForProp } from "../methods";

export const verticalAlign: CreateMethodsFn = () =>
  newMethodsForProp(
    "verticalAlign",
    {
      vBase: "baseline",
      vMid: "middle",
      vTop: "top",
      vBottom: "bottom",
    },
    "va"
  );
