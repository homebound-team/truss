import { CreateMethodsFn } from "../config";
import { newMethodsForProp } from "../methods";

// https://github.com/tachyons-css/tachyons/blob/master/src/_floats.css
export const float: CreateMethodsFn = () =>
  newMethodsForProp(
    "float",
    {
      fl: "left",
      fr: "right",
    },
    "float"
  );
