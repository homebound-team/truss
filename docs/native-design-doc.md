# Native Truss CSS Design

## Overview

Today Truss rewrites `Css.df.$` chains into StyleX objects and runtime calls:

```ts
Css.df.$ -> [css.df] -> stylex.create({ df: { display: "flex" } })
                     -> stylex.props(css.df)
```

That worked for direct `css={Css.df.$}` usage, but it breaks down on one of Truss v1's biggest ergonomic wins: `.$` used to return hash-like objects, so object spread composition worked naturally:

```ts
{ ...styleA, ...styleB }
```

In the current StyleX-based implementation, we return style arrays instead, which forces `rewrite-sites.ts` to try to detect and lower many object-spread patterns into style arrays. That logic is large, fragile, and fighting the natural shape of the legacy codebase.

This doc proposes a drastic simplification: drop the StyleX plugin entirely, keep Truss's own Vite transform, rewrite `Css.df.$` into Truss-native style hashes, and generate/inject the CSS ourselves.

The resulting system should stay very close in spirit to StyleX:

- atomic classes
- property-level last-write-wins semantics
- pseudo/media bundled as ownership of a logical CSS property
- dynamic values implemented via CSS custom properties

But it will no longer depend on StyleX's plugin or runtime.

## Goals

- Make `.$` produce hash-like objects again so `{ ...a, ...b }` just works.
- Preserve StyleX-like semantics for conflict resolution: ownership is per logical CSS property.
- Generate deterministic, human-readable class names based on Truss abbreviations.
- Keep dynamic styles on the StyleX model: static class + CSS variable + inline style value.
- Keep `Css.test.tsx` mostly unchanged as a black-box behavior test suite.
- Keep `.css.ts` support and align runtime-generated CSS with the same rule model.
- Emit a single production stylesheet, `truss.css`, for maximal class reuse.
- Use runtime injection in development so jsdom can observe real CSS rules.

## Non-Goals For Phase 1

- Re-implement StyleX marker/`when()` internals immediately.
- Preserve the exact JS output shape of current transform tests.
- Preserve StyleX-specific imports, calls, or `stylex.create` output.

`marker`, `markerOf`, and `when()` should be deferred to Phase 2 because they currently lean heavily on StyleX-specific selector machinery like `stylex.when.ancestor(...)` and `stylex.defineMarker()`.

## Core Data Model

### Static style hash

`Css.df.$` should rewrite to a plain object keyed by CSS property:

```ts
Css.df.$ -> { display: "df" }
```

`Css.df.fdc.$` should rewrite to:

```ts
Css.df.fdc.$ -> {
  display: "df",
  flexDirection: "fdc",
}
```

This is the heart of the design: object spread now naturally provides property-level override semantics:

```ts
{ ...Css.df.$, ...Css.db.$ } -> { display: "db" }
```

No array flattening, no special spread rewrite, no `asStyleArray` fallback.

### Multi-property abbreviations

Abbreviations that expand to multiple CSS properties must still become atomic at the property level.

Example:

```ts
Css.ba.$ -> {
  borderStyle: "ba_borderStyle",
  borderWidth: "ba_borderWidth",
}
```

And:

```ts
Css.p1.$ -> {
  paddingTop: "p1_paddingTop",
  paddingRight: "p1_paddingRight",
  paddingBottom: "p1_paddingBottom",
  paddingLeft: "p1_paddingLeft",
}
```

This preserves the desired override behavior:

```ts
{ ...Css.ba.$, ...Css.bssDashed.$ }
```

can replace only `borderStyle` while leaving `borderWidth` intact.

### Dynamic style hash

Dynamic values should follow the StyleX approach: a static class points at a CSS variable, and runtime sets the variable.

Example:

```ts
Css.mt(x).$ -> {
  marginTop: ["mt_dyn", "--mt_dyn", __maybeInc(x)],
}
```

And:

```css
.mt_dyn {
  margin-top: var(--mt_dyn);
}
@property --mt_dyn {
  syntax: "*";
  inherits: false;
}
```

At runtime, `trussProps` will turn that into:

- `className: "mt_dyn"`
- `style: { "--mt_dyn": "16px" }`

Literal dynamic calls still fold at build time when possible:

```ts
Css.mt(2).$ -> { marginTop: "mt_16px" }
Css.bc("red").$ -> { borderColor: "bc_red" }
```

### Pseudo and media ownership

Like StyleX, ownership should be at the logical property level.

If base and hover both target `color`, they should collapse into one `color` entry with one class name.

Example:

```ts
Css.black.onHover.blue.$ -> {
  color: {
    value: "black",
    hover: "blue",
  }
}
```

Conceptually that is the right intermediate representation. The emitted runtime hash can be lowered to:

```ts
{
  color: "black_h_blue";
}
```

with generated CSS:

```css
.black_h_blue {
  color: #353535;
}
.black_h_blue:hover {
  color: #526675;
}
```

This means later spreads replace the entire ownership of `color`, including hover/media parts, which matches StyleX semantics.

For example:

```ts
{ ...Css.black.onHover.blue.$, ...Css.white.$ }
```

becomes:

```ts
{
  color: "white";
}
```

and the hover behavior disappears. That is intentional.

The same principle applies to media queries:

```ts
Css.black.ifSm.blue.$ -> { color: "black_sm_blue" }
```

with CSS:

```css
.black_sm_blue {
  color: #353535;
}
@media (max-width: 599px) {
  .black_sm_blue {
    color: #526675;
  }
}
```

### Pseudo-elements

Pseudo-elements should also be part of the logical property's ownership bundle.

Example:

```ts
Css.element("::placeholder").blue.$ -> { color: "placeholder_blue" }
```

with CSS:

```css
.placeholder_blue::placeholder {
  color: #526675;
}
```

## Runtime API

## `trussProps`

`trussProps` should remain the named export from `@homebound/truss/runtime`, but it will no longer wrap StyleX.

Instead it should:

1. accept one or more Truss style hashes
2. merge them in order
3. produce `className`
4. produce inline `style` for CSS variable-backed dynamic values
5. preserve debug metadata in debug mode

Sketch:

```ts
type TrussStyleValue = string | [className: string, cssVarName: string, runtimeValue: string];
type TrussStyleHash = Record<string, TrussStyleValue>;

export function trussProps(...hashes: unknown[]): Record<string, unknown> {
  const merged: Record<string, TrussStyleValue> = {};

  for (const hash of hashes) {
    if (!hash || typeof hash !== "object") continue;
    Object.assign(merged, hash);
  }

  const classNames: string[] = [];
  const inlineStyle: Record<string, string> = {};

  for (const value of Object.values(merged)) {
    if (typeof value === "string") {
      classNames.push(value);
      continue;
    }

    classNames.push(value[0]);
    inlineStyle[value[1]] = value[2];
  }

  const props: Record<string, unknown> = {
    className: classNames.join(" "),
  };

  if (Object.keys(inlineStyle).length > 0) {
    props.style = inlineStyle;
  }

  return props;
}
```

## `mergeProps`

`mergeProps` should likewise stop delegating to StyleX and simply combine:

- explicit `className`
- `trussProps(...)` output
- any generated debug data attribute

## `Css.props`

`Css.props(...)` should continue to exist for callers that want non-`css=` spreading, but build-time rewrites should lower it to `trussProps(...)`.

## CSS Delivery

### Development

Use runtime injection into a `<style>` tag.

Reason: jsdom only sees actual CSS rules in the document, and current black-box tests rely on that behavior.

Truss runtime should expose an internal helper like:

```ts
export function __injectTrussCSS(cssText: string): void;
```

The dev transform should inject calls that register the transformed file's CSS into a shared `<style data-truss>` tag.

Requirements:

- dedupe repeated injection
- work in browser and jsdom
- no-op in SSR/non-DOM environments

### Production

Emit a single global `truss.css` asset.

This gives:

- maximal class reuse across files
- smaller CSS output
- better browser caching
- simpler mental model for atomic class generation

The Vite plugin should collect all generated atomic rules globally during transform and then write a single `truss.css` in `generateBundle`.

## Naming Strategy

### Static classes

- single-property abbreviation uses the abbreviation directly
  - `df`
  - `black`
  - `bgBlue`

- multi-property abbreviation uses `abbrev_cssProperty`
  - `ba_borderStyle`
  - `ba_borderWidth`
  - `p1_paddingTop`

### Dynamic classes

- use `abbrev_dyn`
  - `mt_dyn`
  - `bc_dyn`

with CSS variables named to match:

- `--mt_dyn`
- `--bc_dyn`

### Pseudo / media bundles

Prefer readable deterministic names based on the ownership bundle:

- `black_h_blue`
- `blue_f_black`
- `black_sm_blue`
- `placeholder_blue`
- `bc_dyn_hover`

These names should come from the resolved property bundle, not from random hashes.

## Transform Behavior

### JSX `css` prop

Input:

```tsx
<div css={Css.df.aic.$} />
```

Output:

```tsx
<div {...trussProps({ display: "df", alignItems: "aic" })} />
```

### `className` merge

Input:

```tsx
<div className="existing" css={Css.df.$} />
```

Output:

```tsx
<div {...mergeProps("existing", { display: "df" })} />
```

### Non-JSX style values

Input:

```ts
const s = Css.df.aic.$;
```

Output:

```ts
const s = { display: "df", alignItems: "aic" };
```

### Native object spread composition

Input:

```ts
const styles = {
  wrapper: {
    ...Css.df.aic.$,
    ...(active ? Css.black.$ : Css.blue.$),
  },
};
```

Output:

```ts
const styles = {
  wrapper: {
    display: "df",
    alignItems: "aic",
    ...(active ? { color: "black" } : { color: "blue" }),
  },
};
```

This is the main simplification. We stop converting objects to arrays and instead let JavaScript object semantics do the composition work for us.

### `Css.props`

Input:

```ts
const attrs = {
  ...Css.props(Css.blue.$),
};
```

Output:

```ts
const attrs = {
  ...trussProps({ color: "blue" }),
};
```

## Impact On Existing Plugin Code

## `rewrite-sites.ts`

This file becomes dramatically simpler.

Large sections can be removed:

- style-array flattening logic
- object-spread-to-array lowering
- `asStyleArray` fallback wrapping
- mixed ternary normalization from `{}` to `[]`
- array-specific spread handling

Instead, the rewrite logic should:

- convert resolved chains directly into object expressions keyed by CSS property
- emit `trussProps(hash)` for JSX `css=`
- emit plain object expressions in non-JSX positions
- keep conditional logic by producing object-expression branches

In short, `rewrite-sites.ts` stops trying to reinterpret JS object composition and instead starts embracing it.

## `emit-stylex.ts`

This should become a Truss-native emitter, likely renamed to something like `emit-truss.ts`.

It should:

- collect deduped atomic rule definitions
- generate deterministic class names
- build style-hash AST output instead of `stylex.create(...)`
- build CSS text for runtime injection and production bundling

The resolution pipeline in `resolve-chain.ts` can mostly stay intact; the major change is emission, not semantic resolution.

## `transform.ts`

This file should stop:

- inserting `import * as stylex`
- creating `stylex.create(...)`
- reserving StyleX helper names

And instead should:

- inject `trussProps` / `mergeProps`
- inject dev CSS registration calls when appropriate
- register CSS rules with the plugin for production `truss.css`

## `runtime.ts`

This file becomes the real runtime layer.

It should own:

- `trussProps`
- `mergeProps`
- `TrussDebugInfo`
- dev CSS injection helper

The old `asStyleArray` helper should disappear in Phase 1 because style arrays are no longer the runtime shape.

## CSS Generation Model

Each logical property bundle should emit exactly one class name.

Examples:

```css
.df {
  display: flex;
}
.aic {
  align-items: center;
}
.ba_borderStyle {
  border-style: solid;
}
.ba_borderWidth {
  border-width: 1px;
}

.black_h_blue {
  color: #353535;
}
.black_h_blue:hover {
  color: #526675;
}

.sm_blue {
  color: inherit;
}
@media (max-width: 599px) {
  .sm_blue {
    color: #526675;
  }
}

.mt_dyn {
  margin-top: var(--mt_dyn);
}
@property --mt_dyn {
  syntax: "*";
  inherits: false;
}
```

Note: for media-only or pseudo-only rules with no default value, we should emit only the conditional rule instead of inventing fake base declarations.

Example:

```css
@media (max-width: 599px) {
  .sm_blue {
    color: #526675;
  }
}
```

not:

```css
.sm_blue {
  color: inherit;
}
```

unless a real fallback value is explicitly part of the bundle.

## Test Strategy

## `packages/truss/src/plugin/transform.test.ts`

Keep the test suite, but rewrite expectations around the new model.

Expected changes:

- no StyleX imports
- no `stylex.create`
- no style arrays
- no `stylex.props`
- no `asStyleArray`
- plain object expressions instead of `[css.df, css.aic]`
- `trussProps(...)` and `mergeProps(...)` as the runtime calls

In addition, extend tests so each transform scenario can assert against generated CSS output as well as transformed JS output.

That is important because the runtime shape and stylesheet must stay aligned.

Useful assertions:

- transformed JS matches expected `trussProps(...)` / object output
- generated CSS contains expected atomic rules
- dynamic entries generate expected `var(--...)` declarations
- pseudo/media bundles generate expected selectors

## `packages/app-stylex/src/Css.test.tsx`

This suite should be the least changed because it is behavior-driven.

It already checks:

- actual rendered style behavior
- object spread semantics
- `Css.props`
- pseudo behavior through stylesheet inspection

Likely updates:

- remove StyleX-specific vitest config
- update CSS variable names if expectations are too specific
- keep black-box render assertions largely intact

This suite becomes even more valuable because it validates the public API without caring about internal implementation details.

## Vite Plugin Design

The plugin should own CSS generation end-to-end.

### Dev mode

- transform source files
- generate CSS text for that file's Truss usages
- inject runtime registration code into the transformed JS module

### Build mode

- transform source files
- accumulate global CSS rule registry across modules
- emit one `truss.css` file during bundle generation
- ensure the app includes that stylesheet

The existing `.css.ts` machinery in `transform-css.ts` is already close in spirit and can likely inform or share lower-level CSS formatting helpers.

## Phase 2: `marker` and `when()`

These should be explicitly deferred.

Today they depend on StyleX selector APIs like:

- `stylex.defineMarker()`
- `stylex.defaultMarker()`
- `stylex.when.ancestor(...)`

Recreating them in native CSS is possible, but it is a separate sub-project.

Potential future direction:

- markers become deterministic marker classes applied to elements
- `when("ancestor", marker, ":hover")` lowers to selectors using descendant/sibling combinators
- default marker behavior must be rethought without StyleX internals

For Phase 1, the clean approach is to focus on:

- static styles
- dynamic styles
- pseudo-classes
- pseudo-elements
- media queries
- object spread composition
- `Css.props`

and move `marker`/`when()` to a follow-up implementation.

## Recommended Implementation Order

1. replace `runtime.ts` with Truss-native `trussProps`, `mergeProps`, and dev CSS injection
2. create a Truss-native emitter for style hashes and CSS rule generation
3. simplify `rewrite-sites.ts` around object output instead of arrays
4. update `transform.ts` to remove StyleX imports and wire in CSS delivery
5. update the Vite plugin to emit a single production `truss.css`
6. update transform tests to assert both JS output and CSS output
7. remove StyleX from `packages/app-stylex` Vite/Vitest config
8. update black-box tests only where assumptions are StyleX-specific
9. defer `marker` and `when()` tests to Phase 2

## Summary

The key move is simple:

- Stop returning style arrays.
- Return property-keyed style hashes again.
- Make class ownership per logical CSS property.
- Generate deterministic atomic CSS ourselves.
- Use CSS custom properties for runtime values.

That lets Truss align with the legacy v1 ergonomics while preserving the best parts of StyleX's semantics.

Most importantly, it turns style composition back into ordinary JavaScript object composition, which is what the existing codebase already wants to do.
