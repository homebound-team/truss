import { newMethod, newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

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
