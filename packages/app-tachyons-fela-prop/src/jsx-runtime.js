import { jsx as _jsx } from "react/jsx-runtime";
import { maybeExpandCssProp } from "./render.ts";

export function jsx(type, props, ...children) {
  return _jsx(type, maybeExpandCssProp(props), ...children);
}
