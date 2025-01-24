import { jsx as _jsx, Fragment, jsxs } from "react/jsx-runtime";
import { maybeExpandCssProp } from "./build/cssProp.js";

export { Fragment, jsxs };

export function jsx(type, props, ...children) {
  return _jsx(type, maybeExpandCssProp(props), ...children);
}
