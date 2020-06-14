import { RuleFn } from "./RuleConfig";
import { makeIncRules, makeRules } from "../utils";

export const heightRules: RuleFn = (config) => [
  ...makeRules("height", [
    ["h25", "25%"],
    ["h50", "50%"],
    ["h75", "75%"],
    ["h100", "100%"],
  ]),
  ...makeIncRules(config, "h", "height"),
];
