import { newIncrementMethods, Prop } from "../methods";
import { MethodFn } from "../config";

const directions: Prop[] = ["top", "right", "bottom", "left"];

export const coordinateRules: MethodFn = (config) =>
  directions.flatMap((d) => {
    return newIncrementMethods(config, d, d);
  });
