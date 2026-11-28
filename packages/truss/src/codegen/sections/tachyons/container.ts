import { newMethod, newMethodsForProp } from "src/codegen/methods";
import { CreateMethodsFn } from "src/codegen/config";

export const container: CreateMethodsFn = () => [
  ...newMethodsForProp(
    "containerType",
    {
      cts: "size",
      ctis: "inline-size",
      ctn: "normal",
    },
    "ct",
  ),
  ...newMethodsForProp("containerName", {}, "cn"),
];
