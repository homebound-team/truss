import { newMethod } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const boxShadow: CreateMethodsFn = () => [
  newMethod("shadowNone", { boxShadow: "none" }),
];
