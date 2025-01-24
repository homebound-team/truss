import { jsx as _jsx } from "react/jsx-runtime";
import { maybeExpandCssProp } from "./build/cssProp.js";

export function jsx(type, props, ...children) {
  return _jsx(type, maybeExpandCssProp(props), ...children);
}
