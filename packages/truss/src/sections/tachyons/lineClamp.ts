import { Properties } from "csstype";
import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

const additionalDefs: Properties = {
  overflow: "hidden",
  display: "-webkit-box",
  // As of 11/28/2022, this is deprecated but still necessary for lineClamp to work:
  // https://github.com/tailwindlabs/tailwindcss-line-clamp/blob/master/src/index.js
  WebkitBoxOrient: "vertical",
  // tailwinds doesn't add this by default, but it seems like a good default for us.
  textOverflow: "ellipsis",
}

// https://github.com/tailwindlabs/tailwindcss-line-clamp/
export const lineClamp: CreateMethodsFn = () =>
  newMethodsForProp(
    "WebkitLineClamp",
    {
      lineClamp1: { ...additionalDefs, WebkitLineClamp: 1 },
      lineClamp2: { ...additionalDefs, WebkitLineClamp: 2 },
      lineClamp3: { ...additionalDefs, WebkitLineClamp: 3 },
      lineClamp4: { ...additionalDefs, WebkitLineClamp: 4 },
      lineClamp5: { ...additionalDefs, WebkitLineClamp: 5 },
      lineClamp6: { ...additionalDefs, WebkitLineClamp: 6 },
      lineClampNone: { WebkitLineClamp: "unset" },
    },
    "lineClamp",
    false,
    additionalDefs
);