import * as ReactJSXRuntime from "react/jsx-dev-runtime";
import { expandCssProp } from "./cssProp";
export type { FastCssPropJsx as JSX } from "./jsx-namespace";

export const Fragment = ReactJSXRuntime.Fragment;

export const jsxDEV: typeof ReactJSXRuntime.jsxDEV = (type, props, key, isStatic, source, self) => {
  if (!hasOwn.call(props, "css")) {
    return ReactJSXRuntime.jsxDEV(type, props, key, isStatic, source, self);
  }
  return ReactJSXRuntime.jsxDEV(type, expandCssProp(props), key, isStatic, source, self);
};

const hasOwn = {}.hasOwnProperty;
