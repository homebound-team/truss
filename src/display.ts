import { makeRules } from "./utils";

// https://github.com/tachyons-css/tachyons/blob/master/src/_display.css
export const displayRules = makeRules("display", [
  ["dn", "none"],
  ["db", "block"],
  ["dib", "inlineBlock"],
  ["dit", "inlineTable"],
  ["dt", "table"],
  ["dtc", "tableCell"],
  ["dtRow", "tableRow"],
  ["dtColumn", "tableColumn"],
  ["dtColumnGroup", "tableColumnGroup"],
  // added
  ["dg", "grid"],
]);
