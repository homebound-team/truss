import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

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
