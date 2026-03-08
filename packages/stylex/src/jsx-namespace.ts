import "react";
import type { CssProp } from "./Css";

// Based on @homebound/fast-css-prop's jsx-namespace.ts and Emotion's approach.
// See https://github.com/emotion-js/emotion/blob/main/packages/react/src/jsx-namespace.ts

type IsPreReact19 = 2 extends Parameters<React.FunctionComponent<any>>["length"] ? true : false;

export type { CssProp };

type WithConditionalCSSProp<P> = "className" extends keyof P
  ? string extends P["className" & keyof P]
    ? { css?: CssProp }
    : {}
  : {};

// prettier-ignore
/** @ts-ignore */
type ReactJSXElement = true extends IsPreReact19 ? JSX.Element : React.JSX.Element

// prettier-ignore
/** @ts-ignore */
type ReactJSXElementClass = true extends IsPreReact19 ? JSX.ElementClass : React.JSX.ElementClass

// prettier-ignore
/** @ts-ignore */
type ReactJSXElementAttributesProperty = true extends IsPreReact19 ? JSX.ElementAttributesProperty : React.JSX.ElementAttributesProperty

// prettier-ignore
/** @ts-ignore */
type ReactJSXElementChildrenAttribute = true extends IsPreReact19 ? JSX.ElementChildrenAttribute : React.JSX.ElementChildrenAttribute

// prettier-ignore
/** @ts-ignore */
type ReactJSXLibraryManagedAttributes<C, P> = true extends IsPreReact19 ? JSX.LibraryManagedAttributes<C, P> : React.JSX.LibraryManagedAttributes<C, P>

// prettier-ignore
/** @ts-ignore */
type ReactJSXIntrinsicAttributes = true extends IsPreReact19 ? JSX.IntrinsicAttributes : React.JSX.IntrinsicAttributes

// prettier-ignore
/** @ts-ignore */
type ReactJSXIntrinsicClassAttributes<T> = true extends IsPreReact19 ? JSX.IntrinsicClassAttributes<T> : React.JSX.IntrinsicClassAttributes<T>

// prettier-ignore
/** @ts-ignore */
type ReactJSXIntrinsicElements = true extends IsPreReact19 ? JSX.IntrinsicElements : React.JSX.IntrinsicElements

// prettier-ignore
/** @ts-ignore */
type ReactJSXElementType = true extends IsPreReact19 ? string | React.JSXElementConstructor<any> : React.JSX.ElementType

export namespace ReactJSX {
  export type ElementType = ReactJSXElementType;
  export interface Element extends ReactJSXElement {}
  export interface ElementClass extends ReactJSXElementClass {}
  export interface ElementAttributesProperty extends ReactJSXElementAttributesProperty {}
  export interface ElementChildrenAttribute extends ReactJSXElementChildrenAttribute {}

  export type LibraryManagedAttributes<C, P> = ReactJSXLibraryManagedAttributes<C, P>;

  export interface IntrinsicAttributes extends ReactJSXIntrinsicAttributes {}
  export interface IntrinsicClassAttributes<T> extends ReactJSXIntrinsicClassAttributes<T> {}

  export type IntrinsicElements = ReactJSXIntrinsicElements;
}

export namespace StylexCssPropJsx {
  export type ElementType = ReactJSXElementType;
  export interface Element extends ReactJSXElement {}
  export interface ElementClass extends ReactJSXElementClass {}
  export interface ElementAttributesProperty extends ReactJSXElementAttributesProperty {}
  export interface ElementChildrenAttribute extends ReactJSXElementChildrenAttribute {}

  export type LibraryManagedAttributes<C, P> = P extends unknown
    ? WithConditionalCSSProp<P> & ReactJSXLibraryManagedAttributes<C, P>
    : never;

  export interface IntrinsicAttributes extends ReactJSXIntrinsicAttributes {}
  export interface IntrinsicClassAttributes<T> extends ReactJSXIntrinsicClassAttributes<T> {}

  export type IntrinsicElements = {
    [K in keyof ReactJSXIntrinsicElements]: ReactJSXIntrinsicElements[K] & {
      css?: CssProp;
    };
  };
}
