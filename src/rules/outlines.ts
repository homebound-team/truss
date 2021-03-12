import { RuleFn } from "./TrussConfig";
import { makeRules } from "../utils";

export const outlineRules: RuleFn = () =>
  makeRules("outline", {
    outline: "1px solid",
    outlineTransparent: "1px solid transparent",
    outline0: "0",
  });
