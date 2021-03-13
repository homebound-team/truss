import { newMethod } from "../methods";
import { MethodFn } from "../config";

export const typographyRules: MethodFn = () => [
  newMethod("measure", { maxWidth: "30em", }),
  newMethod("measureWide", { maxWidth: "34em", }),
  newMethod("measureNarrow", { maxWidth: "20em", }),
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
]
