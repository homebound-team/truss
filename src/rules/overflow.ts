import { RuleFn } from "../config";
import { newMethodsForProp } from "../methods";

// https://github.com/tachyons-css/tachyons-overflow/blob/master/src/tachyons-overflow.css
export const overflowRules: RuleFn = () => {
  return [
    ...newMethodsForProp(
      "overflow",
      {
        overflowVisible: "visible",
        overflowHidden: "hidden",
        overflowScroll: "scroll",
        overflowAuto: "auto",
      },
      "overflow"
    ),
    ...newMethodsForProp(
      "overflowY",
      {
        overflowYVisible: "visible",
        overflowYHidden: "hidden",
        overflowYScroll: "scroll",
        overflowYAuto: "auto",
      },
      "overflowY"
    ),
    ...newMethodsForProp(
      "overflowX",
      {
        overflowXVisible: "visible",
        overflowXHidden: "hidden",
        overflowXScroll: "scroll",
        overflowXAuto: "auto",
      },
      "overflowX"
    ),
  ];
};
