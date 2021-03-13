import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

// http://tachyons.io/docs/themes/borders/
export const borderWidth: MethodFn = () =>
  newMethodsForProp(
    "borderWidth",
    {
      bw1: "1px",
      bw2: "2px",
    },
    "bw"
  );
