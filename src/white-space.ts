import { makeRules } from "./utils";

export const whitespaceRules = makeRules("whiteSpace", [
  ["nowrap", "nowrap"],
  ["pre", "pre"],
  ["wsNormal", "normal"],
]);
