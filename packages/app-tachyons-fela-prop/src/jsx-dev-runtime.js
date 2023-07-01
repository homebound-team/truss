import { jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";
import { createRenderer } from "fela";
import { render } from "fela-dom";
// @ts-ignore
import { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED as ReactInternals } from "react";

// Create a renderer
const renderer = createRenderer();
// And then auto-inject any CSS it creates into the DOM
render(renderer);

const weakMap = new WeakMap();

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
export function jsxDEV(type, props = {}, ...children) {
  if (props) {
    const { css, className, ...otherProps } = props;
    if (css) {
      // Use fela/emotion to convert `{ color: "blue" }` --> `a`
      const cn = renderer.renderRule(() => css, {});

      const current = ReactInternals.ReactCurrentDispatcher.current;
      if (!weakMap.has(current)) {
        console.log("CREATE HOOK HERE", current, objectId(current));
        weakMap.set(current, true);
      } else {
        console.log("REUSE HOOK HERE", current, objectId(current));
      }

      // Wrinkles with skipping the wrapper FelaComponent/EmotionCssPropInternal are:
      // 1) Technically we should get renderer from `useContext` instead of a global variable :shrug:
      // 2) Ideally in React 18 we'd use useInsertionEffect to batch style insertions but also maybe :shrug:
      return _jsxDEV(type, { ...otherProps, className: className ? cn + " " + className : cn }, ...children);

      // Or just use `style`, ideally after partitioning `css` into selector/not-selector rules.
      // return _jsxDEV(type, { ...otherProps, style: css }, ...children);
    }
  }
  return _jsxDEV(type, props, ...children);
}

export const objectId = (() => {
  let currentId = 0;
  const map = new WeakMap();
  return (object) => {
    if (!map.has(object)) {
      map.set(object, ++currentId);
    }
    return map.get(object);
  };
})();
