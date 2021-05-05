import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

// https://github.com/tachyons-css/tachyons-overflow/blob/master/src/tachyons-overflow.css
export const overflow: MethodFn = () => {
  return [
    ...newMethodsForProp("overflow", {
      overflowVisible: "visible",
      overflowHidden: "hidden",
      overflowScroll: "scroll",
      overflowAuto: "auto",
    }),
    ...newMethodsForProp("overflowY", {
      overflowYVisible: "visible",
      overflowYHidden: "hidden",
      overflowYScroll: "scroll",
      overflowYAuto: "auto",
    }),
    ...newMethodsForProp("overflowX", {
      overflowXVisible: "visible",
      overflowXHidden: "hidden",
      overflowXScroll: "scroll",
      overflowXAuto: "auto",
    }),
  ];
};
