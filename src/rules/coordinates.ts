import { newIncrementMethods, Prop } from "../utils";
import { RuleFn } from "../config";

const directions: Prop[] = ["top", "right", "bottom", "left"];

export const coordinateRules: RuleFn = (config) =>
  directions.flatMap((d) => {
    return newIncrementMethods(config, d, d);
  });
