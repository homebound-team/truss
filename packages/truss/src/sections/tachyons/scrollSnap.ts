import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

// https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-align
// https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type
export const scrollSnap: CreateMethodsFn = () => [
  ...newMethodsForProp("scrollSnapAlign", {}, "ssa"),
  ...newMethodsForProp("scrollSnapType", {}, "sst"),
];
