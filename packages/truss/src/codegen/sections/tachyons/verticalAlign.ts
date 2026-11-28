import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

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
