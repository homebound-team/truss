import { jsx as _jsx, Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { maybeExpandCssProp } from "./build/cssProp.js";

export { Fragment };

export function jsx(type, props, key) {
  return _jsx(type, maybeExpandCssProp(props), key);
}

export function jsxs(type, props, key) {
  return _jsxs(type, maybeExpandCssProp(props), key);
}
