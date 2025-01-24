import { newMethod } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const boxShadow: CreateMethodsFn = () => [
  // bsn is taken by `borderStyle: none`.
  newMethod("shadowNone", { boxShadow: "none" }),
];
