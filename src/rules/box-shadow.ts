import { makeRule } from "../utils";
import { RuleFn } from "./TrussConfig";

export const boxShadowRules: RuleFn = () => [
  makeRule("shadowNone", { boxShadow: "none" }),
];
