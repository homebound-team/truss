import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://github.com/tachyons-css/tachyons-overflow/blob/master/src/tachyons-overflow.css
export const overflow: CreateMethodsFn = () => {
  return [
    ...newMethodsForProp("overflow", {
      ofv: "visible",
      ofh: "hidden",
      ofs: "scroll",
      ofa: "auto",
    }),
    ...newMethodsForProp("overflowY", {
      ofyv: "visible",
      ofyh: "hidden",
      ofys: "scroll",
      ofya: "auto",
    }),
    ...newMethodsForProp("overflowX", {
      ofxv: "visible",
      ofxh: "hidden",
      ofxs: "scroll",
      ofxa: "auto",
    }),
  ];
};
