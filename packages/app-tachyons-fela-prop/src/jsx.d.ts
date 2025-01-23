import { EmotionJSX } from "./css";

export namespace jsx {
  export namespace JSX {
    export type ElementType = EmotionJSX.ElementType;
    export interface Element extends EmotionJSX.Element {}
    export interface ElementClass extends EmotionJSX.ElementClass {}
    export interface ElementAttributesProperty extends EmotionJSX.ElementAttributesProperty {}
    export interface ElementChildrenAttribute extends EmotionJSX.ElementChildrenAttribute {}
    export type LibraryManagedAttributes<C, P> = EmotionJSX.LibraryManagedAttributes<C, P>;
    export interface IntrinsicAttributes extends EmotionJSX.IntrinsicAttributes {}
    export interface IntrinsicClassAttributes<T> extends EmotionJSX.IntrinsicClassAttributes<T> {}
    export type IntrinsicElements = EmotionJSX.IntrinsicElements;
  }
}
