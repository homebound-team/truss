import { newMethodsForProp } from "src/codegen/methods";
import { CreateMethodsFn } from "src/codegen/config";

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
