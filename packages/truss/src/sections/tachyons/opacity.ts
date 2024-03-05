import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

export const opacity: CreateMethodsFn = () => [
  ...newMethodsForProp(
    "opacity",
    {
      o0: "0",
      o25: "0.25",
      o50: "0.5",
      o75: "0.75",
      o100: "1",
    },
    "o",
  ),
];
