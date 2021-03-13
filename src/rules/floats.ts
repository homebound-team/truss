import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

// https://github.com/tachyons-css/tachyons/blob/master/src/_floats.css
export const floatRules: MethodFn = () =>
  newMethodsForProp("float", {
    fl: "left",
    fn: "none",
    fr: "right",
  });
