import { RuleFn } from "./RuleConfig";
import { makeIncRules, makeRules } from "../utils";

export const heightRules: RuleFn = (config) => [
  // https://github.com/tachyons-css/tachyons/blob/master/src/_heights.css

  // Technically h1 in tachyons is 1em and ours is 1 inc
  ...makeIncRules(config, "h", "height"),

  ...makeRules("height", {
    h25: "25%",
    h50: "50%",
    h75: "75%",
    h100: "100%",
    vh25: "25vh",
    vh50: "50vh",
    vh75: "75vh",
    vh100: "100vh",
  }),

  ...makeRules(
    "minHeight",
    {
      mh0: 0,
      mh100: "100%",
      mvh100: "100vh",
    },
    "mh"
  ),
];
