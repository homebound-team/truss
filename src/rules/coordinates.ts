import { makeIncRules, Prop } from "../utils";
import { RuleFn } from "./RuleConfig";

const directions: Prop[] = ["top", "right", "bottom", "left"];

export const coordinateRules: RuleFn = (config) =>
  directions.flatMap((d) => {
    return makeIncRules(config, d, d);
  });
