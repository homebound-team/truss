import { newMethod } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const boxShadow: CreateMethodsFn = () => [newMethod("bsn", { boxShadow: "none" })];
