import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

// https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transforms
// `rotate`/`scale`/`translate` are the individual transform properties, which compose
// with each other instead of clobbering, unlike repeated `transform` functions.
export const transform: CreateMethodsFn = () => [
  ...newMethodsForProp("backfaceVisibility", {}),
  ...newMethodsForProp("perspective", {}),
  ...newMethodsForProp("perspectiveOrigin", {}),
  ...newMethodsForProp("rotate", {}),
  ...newMethodsForProp("scale", {}),
  ...newMethodsForProp("transform", {}),
  ...newMethodsForProp("transformBox", {}),
  ...newMethodsForProp("transformOrigin", {}),
  ...newMethodsForProp("transformStyle", {}),
  ...newMethodsForProp("translate", {}),
];
