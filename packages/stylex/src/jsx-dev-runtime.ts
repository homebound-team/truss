import * as ReactJSXDevRuntime from "react/jsx-dev-runtime";
import { expandCssProp } from "./expandCssProp";
export type { StylexCssPropJsx as JSX } from "./jsx-namespace";

export const Fragment = ReactJSXDevRuntime.Fragment;

export const jsxDEV: typeof ReactJSXDevRuntime.jsxDEV = (type, props, key, isStaticChildren, source, self) => {
  if (!hasOwn.call(props, "css")) {
    return ReactJSXDevRuntime.jsxDEV(type, props, key, isStaticChildren, source, self);
  }
  return ReactJSXDevRuntime.jsxDEV(type, expandCssProp(props), key, isStaticChildren, source, self);
};

const hasOwn = {}.hasOwnProperty;
