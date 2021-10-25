import { newMethod, zeroTo } from "../methods";
import { MethodFn } from "../config";

// https://github.com/tailwindlabs/tailwindcss-line-clamp/
export const lineClamp: MethodFn = () => [
  ...zeroTo(5).map((i) =>
    newMethod(`lineClamp${i + 1}`, {
      overflow: "hidden",
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: i + 1,
      // tailwinds doesn't add this by default, but it seems like a good default for us.
      textOverflow: "ellipsis",
    })
  ),
  newMethod(`lineClampNone`, { WebkitLineClamp: "unset" }),
];
