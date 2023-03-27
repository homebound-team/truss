import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const whitespace: CreateMethodsFn = () =>
  newMethodsForProp("whiteSpace", {
    nowrap: "nowrap",
    pre: "pre",
    wsNormal: "normal",
    // Keep our old abbrevations + new more abbreviated ones
    wsp: "pre",
    wsn: "normal",
    wsnw: "nowrap",
    wsbs: "break-spaces",
    wspw: "pre-wrap",
    wspl: "pre-line",
  });
