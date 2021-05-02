import { newMethodsForProp } from "../methods";
import { MethodFn } from "../config";

// https://tailwindcss.com/docs/user-select/
export const userSelect: MethodFn = () =>
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
