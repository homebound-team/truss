import { CreateMethodsFn } from "src/config";
import { newMethodsForProp } from "src/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/mask-image
export const mask: CreateMethodsFn = () => newMethodsForProp("maskImage", {});
