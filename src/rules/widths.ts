import { makeIncRules, makeRules } from "../utils";
import { RuleFn } from "./RuleConfig";

export const widthRules: RuleFn = (config) => [
  ...makeRules("width", {
    w25: "25%",
    w50: "50%",
    w75: "75%",
    w100: "100%",
  }),
  ...makeIncRules(config, "w", "width"),
  ...makeIncRules(config, "mw", "minWidth"),
];
