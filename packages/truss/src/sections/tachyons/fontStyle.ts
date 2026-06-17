import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

export const fontStyle: CreateMethodsFn = () =>
  newMethodsForProp(
    "fontStyle",
    {
      fsyi: "italic",
      fsynm: "normal", 
    },
    "fsy",
  );
 