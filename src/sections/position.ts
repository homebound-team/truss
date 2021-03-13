import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

// https://github.com/tachyons-css/tachyons/blob/master/src/_position.css
export const position: MethodFn = () =>
  newMethodsForProp("position", {
    absolute: "absolute",
    fixed: "fixed",
    static: "static",
    relative: "relative",
    // added
    sticky: "sticky",
  });
