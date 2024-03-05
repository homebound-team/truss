import { CreateMethodsFn } from "src/config";
import { newMethodsForProp, newParamMethod } from "src/methods";

// We originally used the tachyons mappings:
// https://github.com/tachyons-css/tachyons/blob/master/src/_flexbox.css#L17
//
// But later shortened them with the rationale that, once we've all been writing
// flex on a day-to-day basis, we don't need the longer "not-Tachyons-ish" names
// that Tachyons originally picked (i.e. maybe because the flex properties were
// "too new/different" at the time of adding them?).
export const flexbox: CreateMethodsFn = () => [
  ...newMethodsForProp(
    "flex",
    {
      fi: "initial",
      fa: "auto",
      fn: "none",
      f1: "1",
      f2: "2",
      f3: "3",
      f4: "4",
      f5: "5",
    },
    "f",
  ),
  ...newMethodsForProp(
    "justifyContent",
    {
      jcfs: "flex-start",
      jcfe: "flex-end",
      jcc: "center",
      jcsb: "space-between",
      jcsa: "space-around",
      jcse: "space-evenly",
    },
    "jc",
  ),

  ...newMethodsForProp(
    "justifySelf",
    {
      jsa: "auto",
      jsc: "center",
      jss: "start",
      jse: "end",
    },
    "js",
  ),

  ...newMethodsForProp(
    "justifyItems",
    {
      jifs: "flex-start",
      jife: "flex-end",
      jic: "center",
      jisb: "space-between",
      jisa: "space-around",
      jise: "space-evenly",
    },
    "ji",
  ),

  ...newMethodsForProp(
    "alignSelf",
    {
      asfs: "flex-start",
      asfe: "flex-end",
      asc: "center",
      asb: "baseline",
      asStretch: "stretch",
    },
    "as",
  ),

  ...newMethodsForProp(
    "alignItems",
    {
      aifs: "flex-start",
      aife: "flex-end",
      ais: "start",
      aie: "end",
      aic: "center",
      aib: "baseline",
      aiStretch: "stretch",
    },
    "ai",
  ),

  ...newMethodsForProp(
    "placeSelf",
    {
      psa: "auto",
      psc: "center",
      pss: "start",
      pse: "end",
      psfs: "flex-start",
      psfe: "flex-end",
      psStretch: "stretch",
    },
    "ps",
  ),

  ...newMethodsForProp(
    "placeContent",
    {
      pcc: "center",
      pcs: "start",
      pce: "end",
      pcsb: "space-between",
      pcsa: "space-around",
      pcse: "space-evenly",
      pcb: "baseline",
      pcStretch: "stretch",
    },
    "pc",
  ),

  ...newMethodsForProp(
    "placeItems",
    {
      pic: "center",
      pis: "start",
      pie: "end",
      pisb: "space-between",
      pisa: "space-around",
      pise: "space-evenly",
      pib: "baseline",
      piStretch: "stretch",
    },
    "pi",
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

  ...newMethodsForProp("flex", { flexAuto: "auto", flexNone: "none" }),

  ...newMethodsForProp("flexGrow", { fg0: 0, fg1: 1 }),
  ...newMethodsForProp("flexShrink", { fs0: 0, fs1: 1 }),

  ...newMethodsForProp(
    "flexDirection",
    {
      fdr: "row",
      fdrr: "row-reverse",
      fdc: "column",
      fdcr: "column-reverse",
    },
    "fd",
  ),

  ...newMethodsForProp(
    "flexWrap",
    {
      fww: "wrap",
      fwr: "wrap-reverse",
      fwnw: "nowrap",
    },
    "flexWrap",
  ),

  newParamMethod("order", "order"),
];
