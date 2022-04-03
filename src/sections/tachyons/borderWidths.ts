import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

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
