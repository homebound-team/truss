import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio
export const aspectRatio: CreateMethodsFn = () =>
  newMethodsForProp(
    "aspectRatio",
    {
      arSquare: "1 / 1",
      arVideo: "16 / 9",
    },
    "ar",
  );
