import { CreateMethodsFn } from "../config";
import { newMethodsForProp } from "../methods";

// http://tachyons.io/docs/themes/borders/
export const borderWidth: CreateMethodsFn = () =>
  newMethodsForProp(
    "borderWidth",
    {
      bw1: "1px",
      bw2: "2px",
    },
    "bw"
  );
