import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

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
