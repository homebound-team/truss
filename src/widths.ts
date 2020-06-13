import { inc } from "./spacing";
import { makeRules } from "./utils";

export const widthRules = [
  ...makeRules("width", [
    ["w25", "25%"],
    ["w50", "50%"],
    ["w75", "75%"],
    ["w100", "100%"],
  ]),
  ...inc("w", "width"),
];
