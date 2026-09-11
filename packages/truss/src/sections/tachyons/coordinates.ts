import { newIncrementMethods } from "src/methods";
import { CreateMethodsFn } from "src/config";

const directions = ["top", "right", "bottom", "left"] as const;

export const coordinates: CreateMethodsFn = (config) => [
  ...directions.flatMap((d) => newIncrementMethods(config, d, d)),
  // `inset` is the shorthand for all four directions.
  ...newIncrementMethods(config, "inset", "inset"),
];
