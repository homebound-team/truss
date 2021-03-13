import { newMethod } from "../methods";
import { MethodFn } from "../config";

export const typeScale: MethodFn = ({ fonts }) =>
  Object.entries(fonts).map(([abbr, defs]) => {
    if (typeof defs === "string") {
      return newMethod(abbr, { fontSize: defs });
    }
    return newMethod(abbr, defs);
  });
