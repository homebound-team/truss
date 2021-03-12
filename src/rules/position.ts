import { RuleFn } from "../config";
import { newMethodsForProp } from "../utils";

// https://github.com/tachyons-css/tachyons/blob/master/src/_position.css
export const positionRules: RuleFn = () =>
  newMethodsForProp("position", {
    absolute: "absolute",
    fixed: "fixed",
    static: "static",
    relative: "relative",
    // added
    sticky: "sticky",
  });
