import { MethodFn } from "../config";
import { newIncrementMethods, newMethodsForProp } from "../methods";

export const height: MethodFn = (config) => [
  // https://github.com/tachyons-css/tachyons/blob/master/src/_heights.css

  // Technically h1 in tachyons is 1em and ours is 1 inc
  ...newIncrementMethods(config, "h", "height"),

  ...newMethodsForProp("height", {
    h25: "25%",
    h50: "50%",
    h75: "75%",
    h100: "100%",
    vh25: "25vh",
    vh50: "50vh",
    vh75: "75vh",
    vh100: "100vh",
  }),

  ...newMethodsForProp(
    "minHeight",
    {
      mh0: 0,
      mh25: "25%",
      mh50: "50%",
      mh75: "75%",
      mh100: "100%",
      mvh100: "100vh",
    },
    "mh"
  ),

  ...newMethodsForProp(
    "maxHeight",
    {
      maxh0: "0",
      maxh25: "25%",
      maxh50: "50%",
      maxh75: "75%",
      maxh100: "100%",
    },
    "maxh"
  ),
];
