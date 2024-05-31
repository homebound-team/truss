import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

// https://github.com/tachyons-css/tachyons/blob/master/src/_text-align.css
export const textAlign: CreateMethodsFn = () =>
  newMethodsForProp(
    "textAlign",
    {
      tal: "left",
      tac: "center",
      tar: "right",
      taj: "justify",
    },
    "ta"
  );
