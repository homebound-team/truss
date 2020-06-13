const borderDefs: [string, [string, string]][] = [
  ["ba", ["borderStyle", "borderWidth"]],
  ["bt", ["borderTopStyle", "borderTopWidth"]],
  ["br", ["borderRightStyle", "borderRightWidth"]],
  ["bb", ["borderBottomStyle", "borderBottomWidth"]],
  ["bl", ["borderLeftStyle", "borderLeftWidth"]],
];

export const borderRules = [
  ...borderDefs.map(([abbr, [style, width]]) => {
    return `get ${abbr}() { return this.add2("${style}", "solid", "${width}", "1px"); }`;
  }),
  `get bn() { return this.add2("borderStyle", "none", "borderWidth", "0"); }`,
];
