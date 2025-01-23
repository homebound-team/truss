import { maybeExpandCssProp } from "packages/app-tachyons-fela-prop/src/render.js";
import { jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";

export function jsxDEV(type, props, ...children) {
  return _jsxDEV(type, maybeExpandCssProp(props), ...children);
}
