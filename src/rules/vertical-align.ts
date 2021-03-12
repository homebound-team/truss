import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

export const verticalAlignRules: MethodFn = () =>
  newMethodsForProp("verticalAlign", {
    vBase: "baseline",
    vMid: "middle",
    vTop: "top",
    vBottom: "bottom",
  });
