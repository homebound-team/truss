import { jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";
import { maybeExpandCssProp } from "./cssProp.ts";

export function jsxDEV(type, props, ...children) {
  return _jsxDEV(type, maybeExpandCssProp(props), ...children);
}
