import { CreateMethodsFn } from "src/codegen/config";
import { newMethodsForProp } from "src/codegen/methods";

// https://developer.mozilla.org/en-US/docs/Web/CSS/mask-image
export const mask: CreateMethodsFn = () => newMethodsForProp("maskImage", {});
