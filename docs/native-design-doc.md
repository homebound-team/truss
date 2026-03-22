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
  borderStyle: "bsSolid",
  borderWidth: "bw1",
}
```

And:

```ts
Css.p1.$ -> {
  paddingTop: "pt1",
  paddingRight: "pr1",
  paddingBottom: "pb1",
  paddingLeft: "pl1",
}
```

This preserves the desired override behavior:

```ts
{ ...Css.ba.$, ...Css.bssDashed.$ }
```

can replace only `borderStyle` while leaving `borderWidth` intact.

### Shorthand expansion

CSS shorthands (`margin`, `padding`, `border`, etc.) should **never** produce shorthand CSS classes. Instead, all shorthand abbreviations expand to their longhand equivalents at build time.

For example, `Css.m1.$` does not produce `{ margin: "m1" }`. It expands to:

```ts
Css.m1.$ -> {
  marginTop: "mt1",
  marginRight: "mr1",
  marginBottom: "mb1",
  marginLeft: "ml1",
}
```

This eliminates the shorthand/longhand specificity problem entirely. In standard CSS, if both `margin: 10px` and `margin-top: 5px` are applied, the longhand wins only because of careful priority ordering. By expanding shorthands to longhands at build time, there is only one specificity tier for property values, and object spread handles conflicts naturally:

```ts
{ ...Css.m1.$, ...Css.mt2.$ }
// -> { marginTop: "mt2", marginRight: "mr1", marginBottom: "mb1", marginLeft: "ml1" }
```

`marginTop` is overridden by the later spread while the other three sides are preserved. No CSS specificity tricks needed.

This applies to all shorthand abbreviations: `p1` expands to `pt1`/`pr1`/`pb1`/`pl1`, `ba` expands to `bsSolid`/`bw1`, `br` expands to the individual border-radius longhands, etc. The emitted CSS only ever contains longhand property declarations.

### Dynamic style hash

Dynamic values should follow the StyleX approach: a static class points at a CSS variable, and runtime sets the variable.

Example:

```ts
Css.mt(x).$ -> {
  marginTop: ["mt_dyn", { "--mt_dyn": __maybeInc(x) }],
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

The tuple format is `[classNames: string, vars: Record<string, string>]` where `classNames` is space-separated (just like static values) and `vars` maps CSS variable names to runtime values. This naturally supports multiple dynamic values within one property bundle:

```ts
Css.bc(x).onHover.bc(y).$ -> {
  borderColor: ["bc_dyn bc_dyn_h", { "--bc_dyn": x, "--bc_dyn_h": y }],
}
```

with CSS:

```css
.bc_dyn {
  border-color: var(--bc_dyn);
}
.bc_dyn_h:hover {
  border-color: var(--bc_dyn_h);
}
```

Literal dynamic calls still fold at build time when possible:

```ts
Css.mt(2).$ -> { marginTop: "mt_16px" }
Css.bc("red").$ -> { borderColor: "bc_red" }
```

### Pseudo and media ownership

Like StyleX, ownership should be at the logical property level.

If base and hover both target `color`, they should collapse into one `color` entry. Each condition produces a **separate atomic class**, and the hash value is a **space-separated string** of all classes in the bundle:

```ts
Css.black.onHover.blue.$ -> {
  color: "black blue_h",
}
```

with generated CSS:

```css
.black {
  color: #353535;
}
.blue_h:hover {
  color: #526675;
}
```

This preserves class reuse: `.black` is the same atomic class everywhere `color: black` appears, regardless of what hover/focus/media behavior accompanies it. The class `.blue_h` is similarly reused anywhere `color: blue` is needed on hover.

Later spreads replace the entire ownership of `color`, including hover/media parts, which matches StyleX semantics:

```ts
{ ...Css.black.onHover.blue.$, ...Css.white.$ }
```

becomes:

```ts
{
  color: "white",
}
```

and the hover behavior disappears because the entire `color` key was replaced. That is intentional.

**Why this works (specificity):** When both `.black` and `.blue_h` are applied to the same element, the pseudo-class adds to the selector's specificity. `.black` has specificity `(0,1,0)` while `.blue_h:hover` has specificity `(0,1,1)`. When hovering, both selectors match, but the hover rule wins due to higher specificity. When not hovering, only `.black` matches.

The same principle applies to media queries:

```ts
Css.black.ifSm.blue.$ -> { color: "black blue_sm" }
```

with CSS:

```css
.black {
  color: #353535;
}
@media (max-width: 599px) {
  .blue_sm.blue_sm {
    color: #526675;
  }
}
```

**Media query specificity:** Media queries do not add specificity, so source order alone would be fragile. Following StyleX's approach, media query classes use a **doubled selector** (`.blue_sm.blue_sm`) to bump specificity to `(0,2,0)`, ensuring they beat base rules `(0,1,0)` regardless of source order.

For stacked conditions (pseudo-class + media query), the doubled selector combines with the pseudo-class:

```ts
Css.black.ifSm.onHover.blue.$ -> { color: "black blue_sm_h" }
```

```css
@media (max-width: 599px) {
  .blue_sm_h.blue_sm_h:hover {
    color: #526675;
  }
}
```

This gives specificity `(0,2,1)`, which correctly beats both base `(0,1,0)` and standalone hover `(0,1,1)`.

Multiple pseudo-classes on the same property work the same way:

```ts
Css.black.onHover.blue.onFocus.red.$ -> { color: "black blue_h red_f" }
```

Each condition is its own atomic class. `trussProps` splits the space-separated value to build the final `className`.

### Pseudo-elements

Pseudo-elements are atomic classes like any other condition. The pseudo-element is part of the CSS selector, and the class is reusable wherever that pseudo-element + value combination appears.

Example:

```ts
Css.element("::placeholder").blue.$ -> { color: "blue_placeholder" }
```

with CSS:

```css
.blue_placeholder::placeholder {
  color: #526675;
}
```

Pseudo-elements can stack with pseudo-classes and media queries within the same property bundle:

```ts
Css.element("::placeholder").blue.onFocus.red.$ -> { color: "blue_placeholder red_placeholder_f" }
```

```css
.blue_placeholder::placeholder {
  color: #526675;
}
.red_placeholder_f:focus::placeholder {
  color: red;
}
```

The `::placeholder` pseudo-element must appear at the end of the selector per CSS spec, so the class ordering is always `.<class>[:<pseudo-class>]::<pseudo-element>`.

## Runtime API

## `trussProps`

`trussProps` should remain the named export from `@homebound/truss/runtime`, but it will no longer wrap StyleX.

Instead it should:

1. accept one or more Truss style hashes (or falsy values, for `cond && styles` ergonomics)
2. merge them in order via `Object.assign` (last-write-wins)
3. split space-separated class name strings to produce the final `className`
4. collect CSS variable maps from dynamic tuples to produce inline `style`
5. preserve debug metadata in debug mode

Sketch:

```ts
/** Space-separated atomic class names, or a dynamic tuple with class names + CSS variable map. */
type TrussStyleValue = string | [classNames: string, vars: Record<string, string>];
type TrussStyleHash = Record<string, TrussStyleValue>;

export function trussProps(...hashes: (TrussStyleHash | false | null | undefined)[]): Record<string, unknown> {
  const merged: Record<string, TrussStyleValue> = {};

  for (const hash of hashes) {
    if (!hash || typeof hash !== "object") continue;
    Object.assign(merged, hash);
  }

  const classNames: string[] = [];
  const inlineStyle: Record<string, string> = {};

  for (const value of Object.values(merged)) {
    if (typeof value === "string") {
      // Space-separated atomic classes, i.e. "black blue_h"
      classNames.push(value);
      continue;
    }

    // Dynamic tuple: [classNames, varsMap]
    classNames.push(value[0]);
    Object.assign(inlineStyle, value[1]);
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

Note: because each value is already space-separated (e.g. `"black blue_h"`), the final `classNames.join(" ")` produces correct output like `"df aic black blue_h"` without any splitting step. The space-separated values pass through directly.

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

Every atomic rule gets a deterministic, human-readable class name. Since each class maps to exactly one `(selector, declaration)` pair, names encode both the value and the condition.

### Base classes

Single-property abbreviation uses the abbreviation directly:

- `df` -> `.df { display: flex }`
- `black` -> `.black { color: #353535 }`
- `bgBlue` -> `.bgBlue { background-color: #526675 }`

Multi-property abbreviations expand to longhand classes (see "Shorthand expansion"):

- `Css.p1.$` reuses `pt1`, `pr1`, `pb1`, `pl1`
- `Css.ba.$` reuses the same classes that standalone `bsSolid` and `bw1` would produce

### Pseudo-class suffixes

Append a short suffix for the pseudo-class:

- `_h` for `:hover`
- `_f` for `:focus`
- `_fv` for `:focus-visible`
- `_a` for `:active`
- `_d` for `:disabled`

Examples:

- `blue_h` -> `.blue_h:hover { color: #526675 }`
- `black_f` -> `.black_f:focus { color: #353535 }`

### Media query suffixes

Append the breakpoint abbreviation:

- `_sm` for the small breakpoint
- `_md` for medium
- `_lg` for large

Examples:

- `blue_sm` -> `@media (...) { .blue_sm.blue_sm { color: #526675 } }`

### Stacked conditions

When pseudo-class and media query combine, concatenate both suffixes:

- `blue_sm_h` -> `@media (...) { .blue_sm_h.blue_sm_h:hover { color: #526675 } }`

### Pseudo-element suffixes

Use the pseudo-element name (without `::`) as a suffix:

- `blue_placeholder` -> `.blue_placeholder::placeholder { color: #526675 }`
- `red_placeholder_f` -> `.red_placeholder_f:focus::placeholder { color: red }`

### Dynamic classes

Use `abbrev_dyn` with the same condition suffixes:

- `mt_dyn` -> `.mt_dyn { margin-top: var(--mt_dyn) }`
- `bc_dyn_h` -> `.bc_dyn_h:hover { border-color: var(--bc_dyn_h) }`

CSS variables are named to match their class:

- `--mt_dyn`
- `--bc_dyn_h`

### `add()` classes

`add()` always takes string literal arguments, so it reuses the dynamic class infrastructure. `Css.add("color", "red").$` compiles to a dynamic-style tuple using the CSS property name as the class basis:

```ts
Css.add("color", "red").$ -> { color: ["color_dyn", { "--color_dyn": "red" }] }
```

This reuses the same `.color_dyn { color: var(--color_dyn) }` class that any other dynamic `color` value would use. The literal value is passed through as an inline style variable, just like a runtime dynamic call. No hashes needed.

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

Each atomic class maps to exactly one CSS rule (one selector + one declaration). Classes are fully independent and reusable across any property bundle.

Examples:

```css
/* Base classes */
.df {
  display: flex;
}
.aic {
  align-items: center;
}
.pt1 {
  padding-top: 8px;
}
.black {
  color: #353535;
}

/* Pseudo-class classes */
.blue_h:hover {
  color: #526675;
}
.red_f:focus {
  color: red;
}

/* Media query classes (doubled selector for specificity) */
@media (max-width: 599px) {
  .blue_sm.blue_sm {
    color: #526675;
  }
}

/* Stacked: media + pseudo (doubled selector + pseudo-class) */
@media (max-width: 599px) {
  .blue_sm_h.blue_sm_h:hover {
    color: #526675;
  }
}

/* Pseudo-element classes */
.blue_placeholder::placeholder {
  color: #526675;
}

/* Dynamic classes */
.mt_dyn {
  margin-top: var(--mt_dyn);
}
@property --mt_dyn {
  syntax: "*";
  inherits: false;
}

.bc_dyn_h:hover {
  border-color: var(--bc_dyn_h);
}
@property --bc_dyn_h {
  syntax: "*";
  inherits: false;
}
```

## Specificity and Rule Ordering

The stylesheet uses three specificity tiers to ensure correct cascade behavior without relying on source order:

| Tier           | Specificity | Selector pattern      | Example                              |
| -------------- | ----------- | --------------------- | ------------------------------------ |
| Base           | `(0,1,0)`   | `.class`              | `.black { color: #353535 }`          |
| Pseudo-class   | `(0,1,1)`   | `.class:pseudo`       | `.blue_h:hover { color: #526675 }`   |
| Media query    | `(0,2,0)`   | `.class.class`        | `.blue_sm.blue_sm { ... }`           |
| Media + pseudo | `(0,2,1)`   | `.class.class:pseudo` | `.blue_sm_h.blue_sm_h:hover { ... }` |

The doubled selector trick for media queries follows StyleX's approach. This means:

1. A media-query-only rule always beats a base rule when the media query matches.
2. A media+pseudo rule always beats a standalone pseudo rule when both the media query and pseudo-class match.
3. Within the same tier, conflicts cannot happen at runtime because object spread already resolved which atomic classes are applied to the element.

Since all shorthands are expanded to longhands (see "Shorthand expansion"), there is no shorthand-vs-longhand specificity concern.

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
