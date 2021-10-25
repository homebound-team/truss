import { newMethod, zeroTo } from "../methods";
import { MethodFn } from "../config";

// https://github.com/tailwindlabs/tailwindcss-line-clamp/
export const lineClamp: MethodFn = () => [
  ...zeroTo(5).map((i) =>
    newMethod(`lineClamp${i + 1}`, {
      overflow: "hidden",
      display: "-webkit-box",
      // These properties are not in csstypes yet
      ...{ "-webkit-box-orient": "vertical", "-webkit-line-clamp": i + 1 },
    })
  ),
  newMethod(`lineClampNone`, { "-webkit-line-clamp": "unset" } as any),
];
