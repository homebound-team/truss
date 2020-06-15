import { RuleFn } from "./RuleConfig";
import { makeRules, makeIncRules } from "../utils";

export const flexboxRules: RuleFn = (config) => [
  ...makeRules(
    "justifyContent",
    {
      justifyStart: "flex-start",
      justifyEnd: "flex-end",
      justifyCenter: "center",
      justifyBetween: "space-between",
      justifyAround: "space-around",
    },
    "justify"
  ),

  ...makeRules(
    "display",
    {
      flex: "flex",
      inlineFlex: "inline-flex",
      flexNone: "none",
    },
    "display"
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
  )
];
