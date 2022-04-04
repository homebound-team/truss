import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

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
