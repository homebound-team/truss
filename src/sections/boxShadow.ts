import { newMethod } from "../methods";
import { CreateMethodsFn } from "../config";

export const boxShadow: CreateMethodsFn = () => [
  newMethod("shadowNone", { boxShadow: "none" }),
];
