import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

export const verticalAlign: CreateMethodsFn = () =>
  newMethodsForProp(
    "verticalAlign",
    {
      vaBaseline: "baseline",
      vam: "middle",
      vat: "top",
      vaBottom: "bottom",
    },
    "va",
  );
