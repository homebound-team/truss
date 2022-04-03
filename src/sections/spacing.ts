import { CreateMethodsFn } from "../config";
import { IncConfig, newIncrementMethods } from "../methods";

export const spacing: CreateMethodsFn = (config) => {
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
    .map(([abbr, conf]) => newIncrementMethods(config, abbr, conf))
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
    .map(([abbr, conf]) => newIncrementMethods(config, abbr, conf))
    .flat();

  return [...margins, ...paddings];
};
