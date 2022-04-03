import { newMethod } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const typeScale: CreateMethodsFn = ({ fonts }) =>
  Object.entries(fonts).map(([abbr, defs]) => {
    if (typeof defs === "string") {
      return newMethod(abbr, { fontSize: defs });
    }
    return newMethod(abbr, defs);
  });
