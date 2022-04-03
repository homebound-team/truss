import { newIncrementMethods } from "../methods";
import { CreateMethodsFn } from "../config";

const directions = ["top", "right", "bottom", "left"] as const;

export const coordinates: CreateMethodsFn = (config) =>
  directions.flatMap((d) => {
    return newIncrementMethods(config, d, d);
  });
