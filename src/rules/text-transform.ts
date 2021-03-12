import { makeRules } from "../utils";
import { RuleFn } from "../config";

// https://github.com/tachyons-css/tachyons/blob/master/src/_text-transform.css
export const textTransformRules: RuleFn = () =>
  makeRules("textTransform", {
    ttc: "capitalize",
    ttl: "lowercase",
    ttu: "uppercase",
    ttn: "none",
  });
