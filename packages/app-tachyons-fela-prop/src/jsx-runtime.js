import { maybeExpandCssProp } from "packages/app-tachyons-fela-prop/src/render.js";
import { jsx as _jsx } from "react/jsx-runtime";

export function jsx(type, props, ...children) {
  return _jsx(type, maybeExpandCssProp(props), ...children);
}
