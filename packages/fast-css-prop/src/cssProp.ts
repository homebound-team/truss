import { createRenderer } from "fela";
import { render } from "fela-dom";
// import { names } from "@homebound/truss-testing-tachyons";

// Create a renderer
const renderer = createRenderer();
// Auto-inject any CSS it creates into the DOM
render(renderer);

// const existingGenerateClassName = (renderer as any).generateClassName.bind(renderer);
// (renderer as any).generateClassName = (
//   property: string,
//   value: string,
//   pseudo: string,
//   media: string,
//   support: string,
// ) => {
//   const ref = property + value + pseudo + media + support;
//   return names[ref] ?? existingGenerateClassName(property, value, pseudo, media, support);
// };

/**
 * Wraps React's JSX runtime (i.e. `createElement`) with `css` prop support.
 *
 * Unlike the Emotion or Fela's native `css` props, we don't create a wrapping
 * `EmotionCssPropInternal` or `FelaComponent` component, which adds another
 * React component to the component tree.
 *
 * Instead, we directly rewrite the `css` prop into the `className` prop, and otherwise
 * leave the `createElement(div, ...)` as-is.
 *
 * Granted, to do this we have to cheat and access the Fela `renderer` from a global
 * const, instead of a context, but "it's fine" (...speaking of its-fine, we could
 * potentially use that to access our Fiber/Context from this function, sans hook).
 */
export function maybeExpandCssProp(props: any): any {
  const { css, className, ...otherProps } = props;
  if (css) {
    // We expect css to be a truss-created object like `{ color: "#121212" }`
    const classNames = renderer.renderRule(() => css, {});
    return {
      className: className ? classNames + " " + className : classNames,
      ...otherProps,
    };
  }
}
