import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://github.com/tachyons-css/tachyons-word-break/blob/master/src/tachyons-word-break.css
export const wordBreak: CreateMethodsFn = () =>
  newMethodsForProp("wordBreak", {
    breakNormal: "normal",
    breakAll: "break-all",
    breakKeepAll: "keep-all",
    breakWord: "break-word",
  });
