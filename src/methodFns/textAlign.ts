import { newMethodsForProp } from "../methods";
import { MethodFn } from "../config";

// https://github.com/tachyons-css/tachyons/blob/master/src/_text-align.css
export const textAlign: MethodFn = () =>
  newMethodsForProp("textAlign", {
    tl: "left",
    tc: "center",
    tr: "right",
    tj: "justify",
  });
