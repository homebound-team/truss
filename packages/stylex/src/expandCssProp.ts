/**
 * Expands the `css` prop (a `CssProp`, i.e. an array of StyleX style refs from `Css.df.aic.$`)
 * into the element's `className` and `style` props by calling `stylex.props()`.
 *
 * Unlike Emotion's css prop, this does NOT create wrapper components. The JSX runtime
 * intercepts props at the factory level and rewrites them directly.
 */
import * as stylex from "@stylexjs/stylex";

export function expandCssProp(props: any): any {
  const { css, className, style, ...otherProps } = props;

  // css is CssProp (StyleRef[]) — resolve via stylex.props()
  const resolved = stylex.props(...(css as any[]));

  const mergedClassName = [resolved.className, className].filter(Boolean).join(" ");
  const mergedStyle = resolved.style ? { ...resolved.style, ...style } : style;

  const result: any = { ...otherProps };
  if (mergedClassName) result.className = mergedClassName;
  if (mergedStyle && Object.keys(mergedStyle).length > 0) result.style = mergedStyle;
  return result;
}
