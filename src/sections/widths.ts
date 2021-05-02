import { newIncrementMethods, newMethodsForProp } from "../methods";
import { MethodFn } from "../config";

export const width: MethodFn = (config) => [
  ...newMethodsForProp(
    "width",
    {
      w25: "25%",
      w50: "50%",
      w75: "75%",
      w100: "100%",
    },
    null
  ),

  ...newMethodsForProp(
    "minWidth",
    {
      mw0: 0,
      mw25: "25%",
      mw50: "50%",
      mw75: "75%",
      mw100: "100%",
    },
    "mw"
  ),

  ...newMethodsForProp(
    "maxWidth",
    {
      maxw0: "0",
      maxw25: "25%",
      maxw50: "50%",
      maxw75: "75%",
      maxw100: "100%",
    },
    "maxw"
  ),

  ...newIncrementMethods(config, "w", "width"),
];
