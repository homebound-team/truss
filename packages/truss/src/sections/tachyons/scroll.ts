import { CreateMethodsFn } from "src/config";
import { IncConfig, newIncrementMethods, newMethodsForProp } from "src/methods";

const scrollMargins: IncConfig[] = [
  ["smt", "scrollMarginTop"],
  ["smr", "scrollMarginRight"],
  ["smb", "scrollMarginBottom"],
  ["sml", "scrollMarginLeft"],
];

// `scrollSnap` and `scrollbarWidth` are their own sections.
// https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-margin
export const scroll: CreateMethodsFn = (config) => [
  ...scrollMargins.flatMap(([abbr, prop]) => newIncrementMethods(config, abbr, prop)),
  ...newMethodsForProp("scrollPadding", {}),
  ...newMethodsForProp("scrollPaddingInline", {}),
  ...newMethodsForProp("scrollPaddingBlock", {}),
  ...newMethodsForProp("scrollBehavior", { scrollSmooth: "smooth" }),
  ...newMethodsForProp("overscrollBehavior", { overscrollContain: "contain" }),
];
