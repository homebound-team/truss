import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

// https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width
export const scrollbarWidth: CreateMethodsFn = () =>
  newMethodsForProp(
    "scrollbarWidth",
    {
      sbwa: "auto",
      sbwt: "thin",
      sbwn: "none",
    },
    "sbw",
  );
