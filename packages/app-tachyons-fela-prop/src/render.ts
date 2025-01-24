import { createRenderer } from "fela";
import { render } from "fela-dom";
import { names } from "@homebound/truss-testing-tachyons";

// Create a renderer
const renderer = createRenderer();
// Auto-inject any CSS it creates into the DOM
render(renderer);

const existingGenerateClassName = renderer.generateClassName.bind(renderer);
renderer.generateClassName = (property: string, value: string, pseudo: string, media: string, support: string) => {
  const ref = property + value + pseudo + media + support;
  return names[ref] ?? existingGenerateClassName(property, value, pseudo, media, support);
};

/**
 * Wraps React's JSX runtime (i.e. `createElement`) with `css` prop support.
 *
 * Unlike the Emotion or native Fela `css` props, we don't create a wrapping
 * `EmotionCssPropInternal` or `FelaComponent` component, which adds another
 * React component to the component tree.
 *
 * Instead, we just merge the `css` prop into the `className` prop, and hand
 * it right back to React as a `createElement(div, ...)` etc.
 *
 * Emotion and Fela likely don't do this b/c they access their `renderer`
 * instance via a React context, which we cannot access directly b/c it
 * would surely cause "different number of hooks" errors due to conditional
 * JSX rendering. Which is dumb b/c accessing a context has no side effect,
 * so IMO contexts should be accessible w/o the hook API/restrictions.
 *
 * But, anyway, we avoid that by just accessing our `renderer` as a global
 * variable.
 */
export function maybeExpandCssProp(props: any = {}) {
  if (props) {
    const { css, className, ...otherProps } = props;
    if (css) {
      // Use fela/emotion to convert `{ color: "blue" }` --> `a`
      // css._className = "black";
      const cn = renderer.renderRule(() => css, {});
      // Wrinkles with skipping the wrapper FelaComponent/EmotionCssPropInternal are:
      // 1) Technically we should get renderer from `useContext` instead of a global variable :shrug:
      // 2) Ideally in React 18 we'd use useInsertionEffect to batch style insertions but also maybe :shrug:
      return { ...otherProps, className: className ? cn + " " + className : cn };
    }
  }
  return props;
}
