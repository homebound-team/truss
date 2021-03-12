import { makeRules } from "../utils";
import { RuleFn } from "./TrussConfig";

export const textDecorationRules: RuleFn = () =>
  makeRules("textDecoration", {
    noUnderline: "none",
    strike: "line-through",
    underline: "underline",
  });
