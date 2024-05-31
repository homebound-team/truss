import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const whitespace: CreateMethodsFn = () =>
  newMethodsForProp("whiteSpace", {
    wsp: "pre",
    wsn: "normal",
    wsnw: "nowrap",
    wsbs: "break-spaces",
    wspw: "pre-wrap",
    wspl: "pre-line",
  });
