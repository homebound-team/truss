import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/border-collapse
export const table: CreateMethodsFn = () => [
  ...newMethodsForProp("borderCollapse", {}),
  ...newMethodsForProp("borderSpacing", {}),
  ...newMethodsForProp("tableLayout", {}),
];
