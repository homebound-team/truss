import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

export const fontStyle: CreateMethodsFn = () =>
  newMethodsForProp(
    "fontStyle",
    {
      fsyi: "italic",
      fsynm: "normal",
    },
    "fsy",
  );
