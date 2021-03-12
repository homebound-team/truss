import { RuleFn } from "../config";
import { newMethodsForProp } from "../utils";

export const verticalAlignRules: RuleFn = () =>
  newMethodsForProp("verticalAlign", {
    vBase: "baseline",
    vMid: "middle",
    vTop: "top",
    vBottom: "bottom",
  });
