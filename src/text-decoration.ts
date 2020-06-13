import { makeRules } from "./utils";

export const textDecorationRules = makeRules("textDecoration", [
  ["noUnderline", "none"],
  ["strike", "line-through"],
  ["underline", "underline"],
]);
