import { newMethodsForProp } from "src/codegen/methods";
import { CreateMethodsFn } from "src/codegen/config";

// https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-align
// https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type
export const scrollSnap: CreateMethodsFn = () => [
  ...newMethodsForProp("scrollSnapAlign", {}, "ssa"),
  ...newMethodsForProp("scrollSnapType", {}, "sst"),
];
