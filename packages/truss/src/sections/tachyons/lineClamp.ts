import { newMethod, zeroTo } from "src/methods";
import { CreateMethodsFn } from "src/config";

// https://github.com/tailwindlabs/tailwindcss-line-clamp/
export const lineClamp: CreateMethodsFn = () => [
  ...zeroTo(5).map((i) =>
    newMethod(`lineClamp${i + 1}`, {
      overflow: "hidden",
      display: "-webkit-box",
      WebkitLineClamp: i + 1,
      // As of 11/28/2022, this is deprecated but still necessary for lineClamp to work:
      // https://github.com/tailwindlabs/tailwindcss-line-clamp/blob/master/src/index.js
      WebkitBoxOrient: "vertical",
      // tailwinds doesn't add this by default, but it seems like a good default for us.
      textOverflow: "ellipsis",
    }),
  ),
  newMethod(`lineClampNone`, { WebkitLineClamp: "unset" }),
];
