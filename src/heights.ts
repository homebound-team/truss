import { inc } from "./spacing";
import { makeRules } from "./utils";

export const heightRules = [
  ...makeRules("height", [
    ["h25", "25%"],
    ["h50", "50%"],
    ["h75", "75%"],
    ["h100", "100%"],
  ]),
  ...inc("h", "height"),
];
