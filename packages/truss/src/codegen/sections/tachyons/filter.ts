import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/filter
export const filter: CreateMethodsFn = () => [
  ...newMethodsForProp("filter", {}),
  ...newMethodsForProp("backdropFilter", {}),
];
