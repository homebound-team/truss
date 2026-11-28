import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

export const outline: CreateMethodsFn = () => [
  ...newMethodsForProp("outline", {
    outline1: "1px solid",
    outlineTransparent: "1px solid transparent",
    outline0: "0",
  }),
  ...newMethodsForProp("outlineColor", {}),
  ...newMethodsForProp("outlineOffset", {}),
  ...newMethodsForProp("outlineStyle", {}),
  ...newMethodsForProp("outlineWidth", {}),
];
