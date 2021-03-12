import { RuleFn } from "../config";
import { makeRules } from "../utils";

// https://github.com/tachyons-css/tachyons-overflow/blob/master/src/tachyons-overflow.css
export const overflowRules: RuleFn = () => {
  return [
    ...makeRules(
      "overflow",
      {
        overflowVisible: "visible",
        overflowHidden: "hidden",
        overflowScroll: "scroll",
        overflowAuto: "auto",
      },
      "overflow"
    ),
    ...makeRules(
      "overflowY",
      {
        overflowYVisible: "visible",
        overflowYHidden: "hidden",
        overflowYScroll: "scroll",
        overflowYAuto: "auto",
      },
      "overflowY"
    ),
    ...makeRules(
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
