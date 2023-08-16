import { newIncrementMethods, newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

export const width: CreateMethodsFn = (config) => [
  ...newMethodsForProp(
    "width",
    {
      w25: "25%",
      w50: "50%",
      w75: "75%",
      w100: "100%",
      wfc: "fit-content",
      wmaxc: "max-content",
      wminc: "min-content",
    },
    // Skip `w` here b/c it's created by newIncrementMethods below
    null,
  ),

  ...newMethodsForProp(
    "minWidth",
    {
      mw0: 0,
      mw25: "25%",
      mw50: "50%",
      mw75: "75%",
      mw100: "100%",
      mwfc: "fit-content",
      mwminc: "min-content",
      mwmaxc: "max-content",
    },
    "mw",
    true,
  ),

  ...newMethodsForProp(
    "maxWidth",
    {
      maxw0: "0",
      maxw25: "25%",
      maxw50: "50%",
      maxw75: "75%",
      maxw100: "100%",
      maxwfc: "fit-content",
      maxwminc: "min-content",
      maxwmaxc: "max-content",
    },
    "maxw",
    true,
  ),

  ...newIncrementMethods(config, "w", "width", { auto: true }),
];
