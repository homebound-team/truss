import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://github.com/tachyons-css/tachyons-overflow/blob/master/src/tachyons-overflow.css
export const overflow: CreateMethodsFn = () => {
  return [
    ...newMethodsForProp("overflow", {
      ov: "visible",
      oh: "hidden",
      os: "scroll",
      oa: "auto",
    }),
    ...newMethodsForProp("overflowY", {
      oyv: "visible",
      oyh: "hidden",
      oys: "scroll",
      oya: "auto",
    }),
    ...newMethodsForProp("overflowX", {
      oxv: "visible",
      oxh: "hidden",
      oxs: "scroll",
      oxa: "auto",
    }),
  ];
};
