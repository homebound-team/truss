import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

// https://tailwindcss.com/docs/user-select/
export const userSelect: CreateMethodsFn = () =>
  newMethodsForProp(
    "userSelect",
    {
      usn: "none",
      ust: "text",
      usAll: "all",
      usAuto: "auto",
    },
    "select",
  );
