import { makeRules } from "./utils";

// https://github.com/tachyons-css/tachyons/blob/master/src/_position.css
export const positionRules = makeRules("position", [
  ["absolute", "absolute"],
  ["fixed", "fixed"],
  ["static", "static"],
  ["relative", "relative"],
  // added
  ["sticky", "sticky"],
]);
