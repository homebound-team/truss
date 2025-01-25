import * as ReactJSXRuntime from "react/jsx-runtime";
import { expandCssProp } from "./cssProp";
export type { FastCssPropJsx as JSX } from "./jsx-namespace";

export const Fragment = ReactJSXRuntime.Fragment;

export const jsx: typeof ReactJSXRuntime.jsx = (type, props, key) => {
  if (!hasOwn.call(props, "css")) {
    return ReactJSXRuntime.jsx(type, props, key);
  }
  return ReactJSXRuntime.jsx(type, expandCssProp(props), key);
};

export const jsxs: typeof ReactJSXRuntime.jsxs = (type, props, key) => {
  if (!hasOwn.call(props, "css")) {
    return ReactJSXRuntime.jsxs(type, props, key);
  }
  return ReactJSXRuntime.jsxs(type, expandCssProp(props), key);
};

const hasOwn = {}.hasOwnProperty;
