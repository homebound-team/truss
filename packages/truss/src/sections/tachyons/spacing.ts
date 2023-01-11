import { CreateMethodsFn } from "src/config";
import { IncConfig, newIncrementMethods } from "src/methods";

export const spacing: CreateMethodsFn = (config) => {
  const marginDefs: IncConfig[] = [
    ["mt", "marginTop"],
    ["mr", "marginRight"],
    ["mb", "marginBottom"],
    ["ml", "marginLeft"],
    ["mx", ["marginLeft", "marginRight"]],
    ["my", ["marginTop", "marginBottom"]],
    ["m", ["marginTop", "marginBottom", "marginRight", "marginLeft"]],
  ];
  const margins = [...marginDefs.map(([abbr, conf]) => newIncrementMethods(config, abbr, conf, { auto: true })).flat()];

  const paddingDefs: IncConfig[] = [
    ["pt", "paddingTop"],
    ["pr", "paddingRight"],
    ["pb", "paddingBottom"],
    ["pl", "paddingLeft"],
    ["px", ["paddingLeft", "paddingRight"]],
    ["py", ["paddingTop", "paddingBottom"]],
    ["p", ["paddingTop", "paddingBottom", "paddingRight", "paddingLeft"]],
  ];
  const paddings = paddingDefs.map(([abbr, conf]) => newIncrementMethods(config, abbr, conf)).flat();

  return [...margins, ...paddings];
};
