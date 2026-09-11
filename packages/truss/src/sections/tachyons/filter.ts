import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/filter
export const filter: CreateMethodsFn = () => [
  ...newMethodsForProp("filter", {}),
  ...newMethodsForProp("backdropFilter", {}),
];
