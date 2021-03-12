import { makeRule } from "../utils";
import { RuleFn } from "../config";

export const typographyRules: RuleFn = () => [
  makeRule("measure", { maxWidth: "30em", }),
  makeRule("measureWide", { maxWidth: "34em", }),
  makeRule("measureNarrow", { maxWidth: "20em", }),
  makeRule("indent", {
    textIndent: "1em",
    marginTop: 0,
    marginBottom: 0,
  }),
  makeRule("smallCaps", { fontVariant: "small-caps" }),
  makeRule("truncate", {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
]
