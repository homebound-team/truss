import { newMethodsForProp } from "../methods";
import { RuleFn } from "../config";

// https://github.com/tachyons-css/tachyons/blob/master/src/_text-transform.css
export const textTransformRules: RuleFn = () =>
  newMethodsForProp("textTransform", {
    ttc: "capitalize",
    ttl: "lowercase",
    ttu: "uppercase",
    ttn: "none",
  });
