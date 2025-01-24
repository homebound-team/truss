import { newMethod, newMethodsForProp, newParamMethod } from "src/methods";
import { CreateMethodsFn } from "src/config";

/** Adds abbreviations like `tiny` -> `12px` or `tiny` -> `{ fontSize: 12px, fontWeight: ... }`. */
export const typeScale: CreateMethodsFn = ({ fonts }) => [
  ...Object.entries(fonts).map(([abbr, defs]) => {
    if (typeof defs === "string") {
      return newMethod(abbr, { fontSize: defs });
    }
    return newMethod(abbr, defs);
  }),
];
