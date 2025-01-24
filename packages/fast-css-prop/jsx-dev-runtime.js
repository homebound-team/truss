import { jsxDEV as _jsxDEV, Fragment, jsxs } from "react/jsx-dev-runtime";
import { maybeExpandCssProp } from "./build/cssProp.js";

export { Fragment, jsxs };

export function jsxDEV(type, props, ...children) {
  return _jsxDEV(type, maybeExpandCssProp(props), ...children);
}
