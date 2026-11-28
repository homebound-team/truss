import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

// http://tachyons.io/docs/themes/borders/
// https://tailwindcss.com/docs/border-style/#app
export const borderStyle: CreateMethodsFn = () =>
  newMethodsForProp(
    "borderStyle",
    {
      bsDashed: "dashed",
      bsDotted: "dotted",
      bsn: "none",
      bss: "solid",
    },
    "bs",
  );
