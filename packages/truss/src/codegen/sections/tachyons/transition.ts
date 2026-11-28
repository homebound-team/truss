import { newMethodsForProp } from "src/codegen/methods";
import { CreateMethodsFn } from "src/codegen/config";

// https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions
export const transition: CreateMethodsFn = () => [
  ...newMethodsForProp("transition", {}),
  ...newMethodsForProp("transitionBehavior", {}),
  ...newMethodsForProp("transitionDelay", {}),
  ...newMethodsForProp("transitionDuration", {}),
  ...newMethodsForProp("transitionProperty", {}),
  ...newMethodsForProp("transitionTimingFunction", {}),
];
