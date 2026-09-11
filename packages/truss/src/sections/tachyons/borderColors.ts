import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

export const borderColor: CreateMethodsFn = (config) => {
  const defs = Object.fromEntries(Object.entries(config.palette).map(([key, value]) => [`bc${key}`, value]));
  return [
    ...newMethodsForProp("borderColor", defs, "bc"),
    // Each side only gets a value method, to keep the palette from making four more methods per color.
    ...newMethodsForProp("borderTopColor", {}, "btc"),
    ...newMethodsForProp("borderRightColor", {}, "brc"),
    ...newMethodsForProp("borderBottomColor", {}, "bbc"),
    ...newMethodsForProp("borderLeftColor", {}, "blc"),
  ];
};
