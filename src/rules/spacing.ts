import { RuleFn } from "./TrussConfig";
import { IncConfig, makeIncRules } from "../utils";

export const spacingRules: RuleFn = (config) => {
  const marginDefs: IncConfig[] = [
    ["mt", "marginTop"],
    ["mr", "marginRight"],
    ["mb", "marginBottom"],
    ["ml", "marginLeft"],
    ["mx", ["ml", "mr"]],
    ["my", ["mt", "mb"]],
    ["m", ["mt", "mb", "mr", "ml"]],
  ];
  const margins = marginDefs
    .map(([abbr, conf]) => makeIncRules(config, abbr, conf))
    .flat();

  const paddingDefs: IncConfig[] = [
    ["pt", "paddingTop"],
    ["pr", "paddingRight"],
    ["pb", "paddingBottom"],
    ["pl", "paddingLeft"],
    ["px", ["pl", "pr"]],
    ["py", ["pt", "pb"]],
    ["p", ["pt", "pb", "pr", "pl"]],
  ];
  const paddings = paddingDefs
    .map(([abbr, conf]) => makeIncRules(config, abbr, conf))
    .flat();

  return [...margins, ...paddings];
};
