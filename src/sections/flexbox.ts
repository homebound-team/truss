import { MethodFn } from "../config";
import { newMethodsForProp } from "../methods";

export const flexbox: MethodFn = () => [
  ...newMethodsForProp(
    "justifyContent",
    {
      js: "flex-start",
      je: "flex-end",
      jc: "center",
      jb: "space-between",
      ja: "space-around",
      jEvenly: "space-evenly",
    },
    "j"
  ),

  ...newMethodsForProp(
    "alignSelf",
    {
      asStart: "flex-start",
      ase: "flex-end",
      asc: "center",
      asb: "baseline",
      asStretch: "stretch",
    },
    "as"
  ),

  ...newMethodsForProp(
    "alignItems",
    {
      ais: "flex-start",
      aie: "flex-end",
      aic: "center",
      aib: "baseline",
      aiStretch: "stretch",
    },
    "ai"
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
    "fb"
  ),

  // https://github.com/tachyons-css/tachyons/blob/master/src/_flexbox.css#L17
  ...newMethodsForProp("flex", { flexAuto: "auto", flexNone: "none" }),

  // https://github.com/tachyons-css/tachyons/blob/master/src/_flexbox.css#L69
  ...newMethodsForProp("flexGrow", { fg0: 0, fg1: 1 }),
  ...newMethodsForProp("flexShrink", { fs0: 0, fs1: 1 }),

  // https://github.com/tachyons-css/tachyons/blob/master/src/_flexbox.css#L25
  ...newMethodsForProp("flexDirection", {
    fdRow: "row",
    fdRowReverse: "row-reverse",
    fdColumn: "column",
    fdColumnReverse: "column-reverse",
  }),
];
