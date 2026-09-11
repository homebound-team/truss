import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// The modern spelling of the `page-break-*` properties, which browsers alias.
// https://developer.mozilla.org/en-US/docs/Web/CSS/break-inside
export const breaks: CreateMethodsFn = () => [
  ...newMethodsForProp("breakInside", { breakAvoid: "avoid" }),
  ...newMethodsForProp("breakAfter", {}),
];
