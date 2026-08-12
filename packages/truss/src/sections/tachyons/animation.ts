import { newMethodsForProp } from "src/methods";
import { CreateMethodsFn } from "src/config";

// https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animations
// Animation values are too open-ended for useful abbreviations (durations, easings,
// user-defined `@keyframes` names), so we only generate the param methods.
export const animation: CreateMethodsFn = () => [
  ...newMethodsForProp("animation", {}),
  ...newMethodsForProp("animationDelay", {}),
  ...newMethodsForProp("animationDirection", {}),
  ...newMethodsForProp("animationDuration", {}),
  ...newMethodsForProp("animationFillMode", {}),
  ...newMethodsForProp("animationIterationCount", {}),
  ...newMethodsForProp("animationName", {}),
  ...newMethodsForProp("animationPlayState", {}),
  ...newMethodsForProp("animationTimingFunction", {}),
];
