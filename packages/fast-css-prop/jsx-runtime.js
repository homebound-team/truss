import { jsx as _jsx, Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { maybeExpandCssProp } from "./build/cssProp.js";

export { Fragment };

export function jsx(type, props, ...children) {
  return _jsx(type, maybeExpandCssProp(props), ...children);
}

export function jsxs(type, props, ...children) {
  return _jsxs(type, maybeExpandCssProp(props), ...children);
}
