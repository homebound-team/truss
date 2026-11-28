import { newMethod } from "src/codegen/methods";
import { CreateMethodsFn } from "src/codegen/config";

export const boxShadow: CreateMethodsFn = () => [
  // bsn is taken by `borderStyle: none`.
  newMethod("shadowNone", { boxShadow: "none" }),
];
