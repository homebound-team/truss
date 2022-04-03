import { newMethodsForProp } from "../methods";
import { CreateMethodsFn } from "../config";

// https://github.com/tachyons-css/tachyons/blob/master/src/_text-transform.css
export const textTransform: CreateMethodsFn = () =>
  newMethodsForProp(
    "textTransform",
    {
      ttc: "capitalize",
      ttl: "lowercase",
      ttu: "uppercase",
      ttn: "none",
    },
    "tt"
  );
