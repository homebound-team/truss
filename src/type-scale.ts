import { fonts } from "./config";

export const typeScaleRules = fonts.map(({ abbr, px }) => {
  return `get ${abbr}() { return this.add("fontSize", "${px}px"); }`;
});
