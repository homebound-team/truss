import { RuleFn } from "../config";
import { makeRules } from "../utils";

export const flexboxRules: RuleFn = () => [
  ...makeRules(
    "justifyContent",
    {
      justifyStart: "flex-start",
      justifyEnd: "flex-end",
      justifyCenter: "center",
      justifyBetween: "space-between",
      justifyAround: "space-around",
      justifyEvenly: "space-evenly",
    },
    "justify"
  ),

  ...makeRules(
    "alignSelf",
    {
      selfStart: "flex-start",
      selfEnd: "flex-end",
      selfCenter: "center",
      selfBaseline: "baseline",
      selfStretch: "stretch",
    },
    "self"
  ),

  ...makeRules(
    "alignItems",
    {
      itemsStart: "flex-start",
      itemsEnd: "flex-end",
      itemsCenter: "center",
      itemsBaseline: "baseline",
      itemsStretch: "stretch",
    },
    "items"
  ),

  ...makeRules(
    "flexBasis",
    // https://github.com/tack-hammer/tailwind-plugin-flex-basis#usage
    {
      fb1: "100%",
      fb2: "50%",
      fb3: "33.333333%",
      fb4: "25%",
      fb5: "20%",
      fb6: "16.666666%",
      fb7: "14.285714%",
      fb0: "12.5%",
    },
    "fb",
  ),

  // https://github.com/tachyons-css/tachyons/blob/master/src/_flexbox.css#L17
  ...makeRules("flex", { flexAuto: "auto", flexNone: "none" }, "flex"),

  // https://github.com/tachyons-css/tachyons/blob/master/src/_flexbox.css#L69
  ...makeRules("flexGrow", { fg0: 0, fg1: 1 }, "flexGrow"),
  ...makeRules("flexShrink", { fs0: 0, fs1: 1 }, "flexShrink"),

  // https://github.com/tachyons-css/tachyons/blob/master/src/_flexbox.css#L25
  ...makeRules("flexDirection", {
    flexRow: "row",
    flexRowReverse: "row-reverse",
    flexColumn: "column",
    flexColumnReverse: "column-reverse",
  }, "flexDirection"),
];
