import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

// https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-align
// https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type
export const scrollSnap: CreateMethodsFn = () => [
  ...newMethodsForProp(
    "scrollSnapAlign",
    { ssan: "none", ssas: "start", ssae: "end", ssac: "center" },
    "ssa",
  ),
  ...newMethodsForProp(
    "scrollSnapType",
    {
      sstn: "none",
      sstxm: "x mandatory",
      sstxp: "x proximity",
      sstym: "y mandatory",
      sstyp: "y proximity",
      sstbm: "both mandatory",
      sstbp: "both proximity",
      sstkm: "block mandatory",
      sstkp: "block proximity",
      sstim: "inline mandatory",
      sstip: "inline proximity",
    },
    "sst",
  ),
];
