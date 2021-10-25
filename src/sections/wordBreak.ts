import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

// https://github.com/tachyons-css/tachyons-word-break/blob/master/src/tachyons-word-break.css
export const wordBreak: MethodFn = () =>
  newMethodsForProp("wordBreak", {
    breakNormal: "normal",
    breakAll: "break-all",
    breakKeepAll: "keep-all",
    breakWord: "break-word",
  });