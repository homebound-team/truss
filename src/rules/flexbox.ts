import { RuleFn } from "./RuleConfig";
import { makeRules } from "../utils";

export const flexboxRules: RuleFn = () => [
  ...makeRules(
    "justifyContent",
    [
      ["justifyStart", "flex-start"],
      ["justifyEnd", "flex-end"],
      ["justifyCenter", "center"],
      ["justifyBetween", "space-between"],
      ["justifyAround", "space-around"],
    ],
    "justify"
  ),

  ...makeRules(
    "display",
    [
      ["flex", "flex"],
      ["inlineFlex", "inline-flex"],
      ["flexNone", "none"],
    ],
    "display"
  ),

  ...makeRules(
    "alignSelf",
    [
      ["selfStart", "flex-start"],
      ["selfEnd", "flex-end"],
      ["selfCenter", "center"],
      ["selfBaseline", "baseline"],
      ["selfStretch", "stretch"],
    ],
    "self"
  ),

  ...makeRules(
    "alignItems",
    [
      ["itemsStart", "flex-start"],
      ["itemsEnd", "flex-end"],
      ["itemsCenter", "center"],
      ["itemsBaseline", "baseline"],
      ["itemsStretch", "stretch"],
    ],
    "items"
  ),
];
