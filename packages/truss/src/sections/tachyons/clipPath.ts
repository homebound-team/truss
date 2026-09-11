import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path
export const clipPath: CreateMethodsFn = () => newMethodsForProp("clipPath", {});
