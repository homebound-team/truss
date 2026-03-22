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

Importantly, the value for each property key is the full ownership bundle for that logical property. In the simplest case that bundle is a single atomic class name:

```ts
{
  display: "df";
}
```

But for pseudo/media/pseudo-element cases it can be a space-separated bundle of reusable atoms:

```ts
{
  color: "black blue_h";
}
```

And for dynamic values it can be a tuple of class bundle + CSS variable map:

```ts
{
  marginTop: ["mt_dyn", { "--mt_dyn": "16px" }];
}
```

The key invariant is that each object key owns one logical CSS property, and later spreads replace that ownership entirely.

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

When a property bundle has multiple dynamic conditions, the tuple carries the full atomic class bundle plus all CSS variables needed by those classes:

```ts
Css.bc(x).onHover.bc(y).$ -> {
  borderColor: ["bc_dyn bc_dyn_h", { "--bc_dyn": x, "--bc_dyn_h": y }],
}
```

That keeps the runtime model uniform: one logical property key, one value, last spread wins.

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

### Condition precedence

Reusable conditional atoms are only safe if we define a deterministic precedence model for situations where multiple conditions match at once.

Examples:

- an element can be both `:hover` and `:focus`
- two custom media queries can overlap
- a media+hover rule can compete with a plain hover rule

So Truss should define two global ordering tables and emit CSS in that order.

#### Pseudo-class precedence

Truss should maintain a fixed pseudo precedence table, from weakest to strongest, for same-property conflicts:

1. `:hover`
2. `:focus`
3. `:focus-visible`
4. `:active`
5. `:disabled`

The exact table can be adjusted, but it must be global and deterministic. When two same-property pseudo rules of equal specificity can both match, later-emitted rules win.

Example:

```ts
Css.black.onHover.blue.onFocus.red.$ -> { color: "black blue_h red_f" }
```

If the element is both hovered and focused, both `.blue_h:hover` and `.red_f:focus` match. Since they have equal specificity, the emitted CSS order decides the winner. Under the table above, focus comes after hover, so focus wins.

#### Media precedence

Named breakpoint helpers like `ifSm`, `ifMd`, and `ifLg` should also have a fixed precedence order, from weakest to strongest, based on Truss's breakpoint model.

For custom string media queries from `Css.if("@media ...")`, Phase 1 should avoid pretending we can always infer the right ordering. Two options are valid:

- support them, but emit them in first-seen order and document that overlapping custom media on the same property are order-sensitive
- or mark overlapping custom media on the same property as unsupported in Phase 1

The second option is safer unless there is strong existing usage.

#### Combined precedence

The stylesheet should be emitted in stable tiers:

1. base atoms
2. pseudo-class atoms, ordered by pseudo precedence table
3. pseudo-element atoms
4. media atoms, ordered by media precedence table
5. media+pseudo atoms, ordered first by media precedence and then pseudo precedence
6. media+pseudo-element and media+pseudo+pseudo-element atoms using the same ordering principles

This keeps rule ordering deterministic while still allowing maximum atom reuse.

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

Pseudo-elements should follow the same ordering model as other conditional atoms. In particular:

- plain pseudo-element atoms should emit after base atoms
- pseudo-class + pseudo-element atoms should emit with the pseudo-class tier for that same precedence level
- media + pseudo-element atoms should emit in the media tier

This avoids underspecifying cases like `::placeholder` plus `:focus::placeholder`.

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
/**
 * Space-separated atomic class names, or a dynamic tuple with class names + CSS variable map.
 *
 * In debug mode, the transform appends a TrussDebugInfo as an extra tuple element:
 * - static with debug: [classNames: string, debugInfo: TrussDebugInfo]
 * - dynamic with debug: [classNames: string, vars: Record<string, string>, debugInfo: TrussDebugInfo]
 */
type TrussStyleValue =
  | string
  | [classNames: string, vars: Record<string, string>]
  | [classNames: string, debugInfo: TrussDebugInfo]
  | [classNames: string, vars: Record<string, string>, debugInfo: TrussDebugInfo];
type TrussStyleHash = Record<string, TrussStyleValue>;

export function trussProps(...hashes: (TrussStyleHash | false | null | undefined)[]): Record<string, unknown> {
  const merged: Record<string, TrussStyleValue> = {};

  for (const hash of hashes) {
    if (!hash || typeof hash !== "object") continue;
    Object.assign(merged, hash);
  }

  const classNames: string[] = [];
  const inlineStyle: Record<string, string> = {};

  const debugSources: string[] = [];

  for (const value of Object.values(merged)) {
    if (typeof value === "string") {
      // Space-separated atomic classes, i.e. "black blue_h"
      classNames.push(value);
      continue;
    }

    // Tuple: [classNames, varsOrDebug, maybeDebug]
    classNames.push(value[0]);

    for (let i = 1; i < value.length; i++) {
      const el = value[i];
      if (el instanceof TrussDebugInfo) {
        debugSources.push(el.src);
      } else if (typeof el === "object" && el !== null) {
        Object.assign(inlineStyle, el);
      }
    }
  }

  const props: Record<string, unknown> = {
    className: classNames.join(" "),
  };

  if (Object.keys(inlineStyle).length > 0) {
    props.style = inlineStyle;
  }

  if (debugSources.length > 0) {
    props["data-truss-src"] = [...new Set(debugSources)].join("; ");
  }

  return props;
}
```

Note: because each value is already space-separated (e.g. `"black blue_h"`), the final `classNames.join(" ")` produces correct output like `"df aic black blue_h"` without any splitting step. The space-separated values pass through directly.

### Debug mode (`TrussDebugInfo`)

When the plugin runs with `debug: true`, the transform appends a `TrussDebugInfo` instance into the first property's tuple value. This carries a compact `"FileName.tsx:line"` source label through the style hash.

`TrussDebugInfo` is a simple class:

```ts
export class TrussDebugInfo {
  readonly src: string;
  constructor(src: string) {
    this.src = src;
  }
}
```

In debug mode, the transform emits tuples with the debug info as an extra element. For static values this means promoting the bare string to a tuple:

```ts
// Without debug:
{ display: "df", color: "black blue_h" }

// With debug:
{ display: ["df", new TrussDebugInfo("MyComponent.tsx:5")], color: "black blue_h" }
```

Only the first property in the hash needs the debug info (it's per-expression, not per-property). For dynamic values the debug info is appended as a third element:

```ts
{
  marginTop: ["mt_dyn", { "--mt_dyn": x }, new TrussDebugInfo("MyComponent.tsx:12")];
}
```

At runtime, `trussProps` collects all `TrussDebugInfo` instances, deduplicates them, and emits a `data-truss-src` attribute on the resulting props:

```ts
{ className: "df aic black blue_h", "data-truss-src": "MyComponent.tsx:5; OtherFile.tsx:10" }
```

This lets developers inspect any element in the DOM and immediately see which Truss expressions contributed to its styles.

## `mergeProps`

`mergeProps` should likewise stop delegating to StyleX and simply combine:

- explicit `className`
- `trussProps(...)` output
- any generated debug data attribute

It also needs to merge inline `style` props, because dynamic Truss styles emit CSS variables.

Example:

```tsx
<div style={{ color: "red" }} css={Css.mt(n).$} />
```

should become something equivalent to:

```tsx
<div {...mergeProps(undefined, { color: "red" }, Css.mt(n).$)} />
```

and produce:

- `className` from Truss styles
- `style={{ color: "red", "--mt_dyn": "16px" }}`

So in practice `mergeProps` should be a small React-prop merge helper, not just a className concatenator.

Suggested shape:

```ts
export function mergeProps(
  explicitClassName: string | undefined,
  explicitStyle: Record<string, unknown> | undefined,
  ...hashes: Array<TrussStyleHash | false | null | undefined>
): Record<string, unknown>;
```

If there is no explicit style prop, the transform can pass `undefined`.

## `Css.props`

`Css.props(...)` should continue to exist for callers that want non-`css=` spreading, but build-time rewrites should lower it to `trussProps(...)`.

## CSS Delivery

### Development: virtual CSS endpoint + HMR

In dev mode, the Vite plugin should serve the collected CSS via a virtual endpoint and use Vite's HMR to push updates to the browser. This follows the same approach as the [StyleX Vite plugin](https://github.com/facebook/stylex/blob/main/packages/%40stylexjs/unplugin/src/vite.js).

The mechanism has three parts:

**1. CSS endpoint middleware.** The plugin registers a `configureServer` middleware that serves the current collected CSS at a virtual path (e.g. `/virtual:truss.css`). Each request calls a `collectCss()` function that returns the full CSS string from the global rule registry. The response uses `Cache-Control: no-store` so the browser always gets fresh content.

**2. Virtual runtime script.** The plugin injects a `<script type="module">` tag into the HTML via `transformIndexHtml` that points to a virtual module (e.g. `virtual:truss:runtime`). This script:

- Creates a `<style id="__truss_virtual__">` element in `<head>`
- Fetches CSS from the virtual endpoint and sets it as the style's `textContent`
- Listens for a custom HMR event (`truss:css-update`) to re-fetch and update
- Also listens for `vite:afterUpdate` as a fallback (with a small delay) to catch cases where the HMR event fires before the transform completes

**3. HMR event dispatch.** The plugin maintains a version counter in its shared state. Each time a file is transformed and new CSS rules are collected, the version increments. A `configureServer` interval (or `handleHotUpdate` hook) detects version changes and sends the `truss:css-update` custom event via `server.ws.send()`. The `handleHotUpdate` hook also fires the event on any file change for safety.

This approach means:

- No per-file `__injectTrussCSS()` calls are needed in transformed JS modules
- The browser always has the complete, correctly-ordered stylesheet
- HMR updates are near-instant (just a CSS re-fetch, no full page reload)
- jsdom environments for tests can use a simpler `__injectTrussCSS()` helper that writes to a `<style>` tag directly, since jsdom doesn't have Vite's dev server

**jsdom / test environment.** For unit tests running in jsdom (without Vite's dev server), the transform should still inject `__injectTrussCSS(cssText)` calls so that `document.styleSheets` reflects the CSS rules. This is a test-only code path gated on the environment.

### Production

Emit a single global `truss.css` asset.

This gives:

- maximal class reuse across files
- smaller CSS output
- better browser caching
- simpler mental model for atomic class generation

The Vite plugin should collect all generated atomic rules globally during transform. In `generateBundle`, it should either:

- Append the collected CSS to an existing CSS asset in the bundle (matching StyleX's `pickCssAssetFromRollupBundle` approach)
- Or emit a standalone `truss.css` asset if no existing CSS asset is found

The `writeBundle` hook should also write the CSS to disk as a fallback, in case `generateBundle` didn't find a suitable target asset.

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

`add()` should reuse the dynamic class infrastructure because it accepts arbitrary property names and values at the callsite.

For a runtime value:

```ts
Css.add("color", color).$ -> { color: ["color_dyn", { "--color_dyn": color }] }
```

For a literal value, Phase 1 has two possible behaviors:

- fold to a static atom when we want maximal CSS reuse and smaller inline styles
- or still use the dynamic class path for implementation simplicity

The preferred behavior is to fold literals to static atoms when both the property and value are string literals, because that better matches the rest of Truss's compile-time folding.

So the ideal behavior is:

```ts
Css.add("color", "red").$ -> { color: "color_red" }
Css.add("color", color).$ -> { color: ["color_dyn", { "--color_dyn": color }] }
```

If implementation simplicity forces Phase 1 to make all `add()` calls dynamic, the doc and tests should say so explicitly. What matters most is that the behavior is deliberate and documented.

Dynamic example:

```ts
Css.add("color", "red").$ -> { color: ["color_dyn", { "--color_dyn": "red" }] }
```

This reuses the same `.color_dyn { color: var(--color_dyn) }` class that any other dynamic `color` value would use.

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
<div {...mergeProps("existing", undefined, { display: "df" })} />
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
3. Within the same tier, two classes targeting _different_ logical properties cannot conflict because object spread already resolved which atomic classes are applied to the element. Two classes targeting the _same_ property at the same tier (e.g. `:hover` and `:focus` both active) are resolved by stable global emission order as defined in the "Condition precedence" section.

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

### `.css.ts` files

`.css.ts` files provide a way to write Truss-styled CSS rules with explicit selectors, for cases where `css=` prop usage isn't appropriate (e.g. global overrides, third-party component styling).

The existing pipeline works as follows:

1. `transform-css.ts` parses the `.css.ts` file and resolves `Css.*.$` chains into CSS declarations, producing a raw CSS string.
2. `rewrite-css-ts-imports.ts` rewrites imports of `.css.ts` modules to inject a `?truss-css` side-effect import that pipes the generated CSS through Vite's native CSS pipeline.
3. Named exports from `.css.ts` files (e.g. class name constants) remain available as normal TypeScript imports.

In the new native model, this pipeline stays largely the same. The key change is that `transform-css.ts` should use the same atomic class generation and CSS formatting helpers as the main emitter, so that `.css.ts` output is consistent with `truss.css`.

In production, `.css.ts` output should be **appended to the global `truss.css`** file rather than emitted as separate CSS assets. This gives a single stylesheet for the entire app, maximizing cache efficiency and eliminating any ordering concerns between Truss atomic classes and `.css.ts` rules.

In dev mode, `.css.ts` files can continue using Vite's native CSS injection via the `?truss-css` virtual module pipeline, since Vite handles HMR for those modules automatically.

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
