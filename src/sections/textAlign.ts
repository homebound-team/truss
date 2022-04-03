import { newMethodsForProp } from "../methods";
import { CreateMethodsFn } from "../config";

// https://github.com/tachyons-css/tachyons/blob/master/src/_text-align.css
export const textAlign: CreateMethodsFn = () =>
  newMethodsForProp(
    "textAlign",
    {
      tl: "left",
      tc: "center",
      tr: "right",
      tj: "justify",
    },
    "ta"
  );
