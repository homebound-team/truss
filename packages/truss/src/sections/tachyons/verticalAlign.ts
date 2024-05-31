import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

export const verticalAlign: CreateMethodsFn = () =>
  newMethodsForProp(
    "verticalAlign",
    {
      vaBl: "baseline",
      vam: "middle",
      vat: "top",
      vaBm: "bottom",
    },
    "va",
  );
