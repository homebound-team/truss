import { makeRules } from "./utils";

// https://github.com/tachyons-css/tachyons/blob/master/src/_text-align.css
export const textAlignRules = makeRules("textAlign", [
  ["tl", "left"],
  ["tc", "center"],
  ["tr", "right"],
  ["tj", "justify"],
]);
