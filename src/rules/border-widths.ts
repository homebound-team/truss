import { MethodFn } from "../config";
import { newMethodsForProp, newIncrementMethods } from "../methods";

// http://tachyons.io/docs/themes/borders/
export const borderWidthRules: MethodFn = () =>
  newMethodsForProp(
    "borderWidth",
    {
      bw1: "1px",
      bw2: "2px",
    },
    "bw"
  );
