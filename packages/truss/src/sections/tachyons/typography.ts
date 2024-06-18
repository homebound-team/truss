import { newMethod, newMethodsForProp, newParamMethod } from "src/methods";
import { CreateMethodsFn } from "src/config";

// See typeScale for the FontConfig.fonts handling

export const typography: CreateMethodsFn = () => [
  newMethod("measure", { maxWidth: "30em" }),
  newMethod("measureWide", { maxWidth: "34em" }),
  newMethod("measureNarrow", { maxWidth: "20em" }),
  newMethod("indent", {
    textIndent: "1em",
    marginTop: 0,
    marginBottom: 0,
  }),
  newMethod("smallCaps", { fontVariant: "small-caps" }),
  newMethod("truncate", {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
  // Include `fs(...)` & `fsPx(...)` for one-off font-sizes. We technically also have
  // `fs0` and `fs1` for `flexShrink`, but this seems fine.
  ...newMethodsForProp("fontSize", {}, "fs", true),
  ...newMethodsForProp("lineHeight", {}, "lh", true),
];
