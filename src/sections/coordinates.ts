import { newIncrementMethods } from "../methods";
import { MethodFn } from "../config";

const directions = ["top", "right", "bottom", "left"] as const;

export const coordinates: MethodFn = (config) =>
  directions.flatMap((d) => {
    return newIncrementMethods(config, d, d);
  });
