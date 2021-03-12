import { RuleFn } from "../config";
import { newMethodsForProp } from "../utils";

export const flexboxRules: RuleFn = () => [
  ...newMethodsForProp(
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

  ...newMethodsForProp(
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

  ...newMethodsForProp(
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

  ...newMethodsForProp(
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
  ...newMethodsForProp("flex", { flexAuto: "auto", flexNone: "none" }, "flex"),

  // https://github.com/tachyons-css/tachyons/blob/master/src/_flexbox.css#L69
  ...newMethodsForProp("flexGrow", { fg0: 0, fg1: 1 }, "flexGrow"),
  ...newMethodsForProp("flexShrink", { fs0: 0, fs1: 1 }, "flexShrink"),

  // https://github.com/tachyons-css/tachyons/blob/master/src/_flexbox.css#L25
  ...newMethodsForProp("flexDirection", {
    flexRow: "row",
    flexRowReverse: "row-reverse",
    flexColumn: "column",
    flexColumnReverse: "column-reverse",
  }, "flexDirection"),
];
