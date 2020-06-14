import { RuleFn } from "./RuleConfig";
import { makeRules } from "../utils";

export const borderRadiusRules: RuleFn = () =>
  makeRules("borderRadius", [
    ["br0", "0"],
    ["br1", ".125rem"],
    ["br2", ".25rem"],
    ["br3", ".5rem"],
    ["br4", "1rem"],
    ["br100", "100%"],
    ["brPill", "9999px"],
  ]);
