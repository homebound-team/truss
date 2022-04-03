import { newMethodsForProp } from "../methods";
import { CreateMethodsFn } from "../config";

// https://tailwindcss.com/docs/user-select/
export const userSelect: CreateMethodsFn = () =>
  newMethodsForProp(
    "userSelect",
    {
      selectNone: "none",
      selectText: "text",
      selectAll: "all",
      selectAuto: "auto",
    },
    "select"
  );
