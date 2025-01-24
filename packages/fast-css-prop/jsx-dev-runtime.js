import { jsxDEV as _jsxDEV, Fragment } from "react/jsx-dev-runtime";
import { maybeExpandCssProp } from "./build/cssProp.js";

export { Fragment };

export function jsxDEV(type, props, key, isStaticChildren, source, self) {
  return _jsxDEV(type, maybeExpandCssProp(props), key, isStaticChildren, source, self);
}
