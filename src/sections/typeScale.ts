import { newMethod } from "../methods";
import { CreateMethodsFn } from "../config";

export const typeScale: CreateMethodsFn = ({ fonts }) =>
  Object.entries(fonts).map(([abbr, defs]) => {
    if (typeof defs === "string") {
      return newMethod(abbr, { fontSize: defs });
    }
    return newMethod(abbr, defs);
  });
