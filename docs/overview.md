# Truss Native CSS Architecture

## Overview

Truss is a build-time CSS-in-JS system that compiles `Css.df.aic.$` chains into atomic CSS classes and property-keyed style hashes. A Vite plugin transforms source files at build time, replacing Truss expressions with plain objects and emitting a single `truss.css` stylesheet.

The core idea: `Css.df.$` compiles to `{ display: "df" }`, where `"df"` is the class name for `.df { display: flex }`. Because the output is a plain object keyed by CSS property, standard JavaScript object spread provides property-level override semantics for free:

```ts
{ ...Css.df.$, ...Css.db.$ }  // → { display: "db" }
```

No special runtime merging, no style arrays, no framework-specific composition primitives.

### Why not StyleX?

Truss previously used [StyleX](https://stylexjs.com/) as its compilation backend. StyleX's `stylex.create` / `stylex.props` pipeline produces style arrays, which broke one of Truss's most important ergonomics: object spread composition. The StyleX-based implementation required a large `rewrite-sites.ts` module (~1000 lines) that tried to detect and lower object-spread patterns into style arrays — logic that was fragile and fought the natural shape of the codebase.

The native approach preserves StyleX's best ideas — atomic classes, property-level last-write-wins semantics, CSS custom properties for runtime values, specificity tiers via doubled selectors — while returning to plain object output that makes JavaScript's built-in object composition work correctly.

## Data Model

### Static style hashes

Each `Css.*.$` expression compiles to an object keyed by CSS property, where values are atomic class names:

```ts
Css.df.fdc.$ → { display: "df", flexDirection: "fdc" }
```

Multi-property abbreviations expand to their individual longhands:

```ts
Css.p1.$ → { paddingTop: "pt1", paddingRight: "pr1", paddingBottom: "pb1", paddingLeft: "pl1" }
Css.ba.$ → { borderStyle: "bss", borderWidth: "bw1" }
```

This means `{ ...Css.ba.$, ...Css.bssDashed.$ }` replaces only `borderStyle` while leaving `borderWidth` intact.

### Shorthand expansion

CSS shorthands (`margin`, `padding`, `border`, etc.) always expand to longhands at build time. `Css.m1.$` produces four `margin-*` longhands, never a `margin` shorthand. This eliminates shorthand/longhand specificity conflicts entirely — there is only one specificity tier for property values, and object spread handles conflicts naturally.

### Variable styles

Runtime values use CSS custom properties. A static class points at a CSS variable, and the runtime sets the variable via inline style:

```ts
Css.mt(x).$ → { marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] }
```

The tuple format is `[classNames: string, vars: Record<string, string>]`. At runtime, `trussProps` splits this into `className: "mt_var"` and `style: { "--marginTop": "16px" }`.

When the argument is a literal, the value is folded at build time into a static class:

```ts
Css.mt(2).$ → { marginTop: "mt_16px" }
Css.bc("red").$ → { borderColor: "bc_red" }
```

### Pseudo-class and media query ownership

Ownership is per logical CSS property. If base and hover both target `color`, they collapse into one `color` entry with a space-separated class bundle:

```ts
Css.black.onHover.blue.$ → { color: "black h_blue" }
```

Later spreads replace the entire bundle — replacing `color` removes both the base and hover parts:

```ts
{ ...Css.black.onHover.blue.$, ...Css.white.$ } → { color: "white" }
```

Media queries work the same way:

```ts
Css.black.ifSm.blue.$ → { color: "black sm_blue" }
```

Stacked conditions (media + pseudo) combine both prefixes:

```ts
Css.black.ifSm.onHover.blue.$ → { color: "black sm_h_blue" }
```

### Relationship selectors (`marker` / `when()`)

Markers are deterministic CSS classes applied to elements. `when()` conditions compile to CSS relationship selectors:

```ts
Css.marker.$                              → { __marker: "__truss_m" }
Css.markerOf(row).$                       → { __marker: "__truss_m_row" }
Css.when("ancestor", ":hover").blue.$     → { color: "wh_anc_h_blue" }
Css.when("descendant", ":focus").blue.$   → { color: "wh_desc_f_blue" }
Css.when("siblingBefore", ":hover").blue.$ → { color: "wh_sibB_h_blue" }
```

Selector lowering by relationship type:

| Relationship    | CSS selector pattern             |
| --------------- | -------------------------------- |
| `ancestor`      | `.marker:pseudo .target`         |
| `descendant`    | `.target:has(.marker:pseudo)`    |
| `siblingBefore` | `.marker:pseudo ~ .target`       |
| `siblingAfter`  | `.target:has(~ .marker:pseudo)`  |
| `anySibling`    | Both sibling directions combined |

`when()` variants participate in the same property-keyed model — object spread is the single override mechanism.

## Runtime API

### `trussProps`

Accepts one or more style hashes (or falsy values), merges them via `Object.assign`, splits space-separated class names for `className`, and collects CSS variable maps for inline `style`:

```ts
trussProps({ display: "df", color: "black h_blue" }, { color: "white" });
// → { className: "df white" }
```

In debug mode, style hash tuples can carry `TrussDebugInfo` instances that produce a `data-truss-src` attribute showing which source expressions contributed to an element's styles.

### `mergeProps`

Merges explicit `className`, explicit `style`, and Truss style hashes. The transform emits this when a JSX element has both `className` (or `style`) and `css=` props:

```ts
mergeProps("existing-class", { minWidth: "fit-content" }, { display: "df" });
// → { className: "existing-class df", style: { minWidth: "fit-content" } }
```

## Build-Time Plugin

The Vite plugin (`packages/truss/src/plugin/index.ts`) orchestrates transform and CSS delivery.

### Transform pipeline

1. **Chain extraction** — `transform.ts` parses the file, finds `Css.*.$` chains, and resolves each chain into segments via `resolve-chain.ts`.
2. **CSS rule collection** — `emit-truss.ts` (`collectAtomicRules`) processes segments into a global `Map<string, AtomicRule>`. Each atomic rule maps one class name to one CSS selector + declaration pair.
3. **AST rewriting** — `rewrite-sites.ts` replaces each `Css.*.$` expression with an object expression (`{ display: "df", ... }`), and rewrites JSX `css=` props into `trussProps(...)` or `mergeProps(...)` calls.
4. **CSS text generation** — `emit-truss.ts` (`generateCssText`) serializes collected rules into CSS text, ordered by specificity tiers.

### Key source files

| File               | Role                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| `transform.ts`     | Entry point — orchestrates parsing, chain resolution, rewriting, output |
| `resolve-chain.ts` | Resolves `Css.*.$` member chains into typed segments                    |
| `emit-truss.ts`    | Atomic rule collection, class naming, CSS generation, AST building      |
| `rewrite-sites.ts` | Rewrites expression sites — objects, JSX props, `Css.props()` calls     |
| `runtime.ts`       | Runtime exports: `trussProps`, `mergeProps`, `TrussDebugInfo`           |
| `index.ts`         | Vite plugin — global CSS registry, dev HMR, production CSS emission     |

### Dev mode

The plugin serves collected CSS via a virtual endpoint (`/virtual:truss.css`) and uses Vite's HMR to push updates. A virtual runtime script creates a `<style>` tag and re-fetches CSS on `truss:css-update` events. No per-file CSS injection is needed in the browser.

For jsdom tests, the plugin passes `injectCss: true`, which injects `__injectTrussCSS(cssText)` calls into each transformed file so `document.styleSheets` reflects the rules.

### Production mode

The plugin accumulates all atomic rules across files during transform. In `generateBundle`, it appends the full CSS to an existing CSS asset or emits a standalone `truss.css`. The `writeBundle` hook writes to disk as a fallback.

## CSS Generation

### Naming strategy

Class names are deterministic and human-readable:

| Pattern               | Example class              | CSS                                                   |
| --------------------- | -------------------------- | ----------------------------------------------------- |
| Base                  | `df`                       | `.df { display: flex }`                               |
| Pseudo-class          | `h_blue`                   | `.h_blue:hover { color: #526675 }`                    |
| Media query           | `sm_df`                    | `@media (...) { .sm_df.sm_df { display: flex } }`     |
| Media + pseudo        | `sm_h_blue`                | `@media (...) { .sm_h_blue.sm_h_blue:hover { ... } }` |
| Pseudo-element        | `placeholder_blue`         | `.placeholder_blue::placeholder { color: #526675 }`   |
| Variable              | `mt_var`                   | `.mt_var { margin-top: var(--marginTop) }`            |
| Literal-folded        | `mt_16px`                  | `.mt_16px { margin-top: 16px }`                       |
| `add()` literal       | `add_transition_all_240ms` | `.add_transition_all_240ms { transition: all 240ms }` |
| `add()` variable      | `color_var`                | `.color_var { color: var(--color) }`                  |
| `when()` relationship | `wh_anc_h_blue`            | `.__truss_m:hover .wh_anc_h_blue { color: #526675 }`  |

### Specificity tiers

The stylesheet uses specificity tiers so cascade behavior is correct regardless of source order:

| Tier                  | Specificity | Selector pattern      | Example                                |
| --------------------- | ----------- | --------------------- | -------------------------------------- |
| Base                  | `(0,1,0)`   | `.class`              | `.black { color: #353535 }`            |
| Pseudo-class          | `(0,1,1)`   | `.class:pseudo`       | `.h_blue:hover { color: #526675 }`     |
| Pseudo-element        | `(0,1,1)`   | `.class::element`     | `.placeholder_blue::placeholder {...}` |
| Relationship (`when`) | `(0,2,0)+`  | combinator selectors  | `.__truss_m:hover .target { ... }`     |
| Media query           | `(0,2,0)`   | `.class.class`        | `.sm_blue.sm_blue { ... }`             |
| Media + pseudo        | `(0,2,1)`   | `.class.class:pseudo` | `.sm_h_blue.sm_h_blue:hover { ... }`   |

The doubled selector for media queries follows the same approach StyleX uses — it bumps specificity to `(0,2,0)` so media rules always beat base rules when the query matches, regardless of source order.

### Condition precedence

Within the same specificity tier, CSS source order determines the winner. Truss defines fixed global ordering tables:

**Pseudo-class precedence** (weakest to strongest): `:hover` → `:focus` → `:focus-visible` → `:active` → `:disabled`

**Media precedence**: Named breakpoints (`ifSm`, `ifMd`, `ifLg`) follow the breakpoint model ordering.

Rules are emitted in stable tiers: base → pseudo (by precedence) → pseudo-element → `when()` → media → media+pseudo → media+pseudo-element → `@property` declarations.

## Transform Examples

### JSX `css` prop

```tsx
// Input
<div css={Css.df.aic.$} />
// Output
<div {...trussProps({ display: "df", alignItems: "aic" })} />
```

### `className` + `css` merge

```tsx
// Input
<div className="existing" css={Css.df.$} />
// Output
<div {...mergeProps("existing", undefined, { display: "df" })} />
```

### Non-JSX style values

```ts
// Input
const s = Css.df.aic.$;
// Output
const s = { display: "df", alignItems: "aic" };
```

### Object spread composition

```ts
// Input
const styles = { ...Css.df.aic.$, ...(active ? Css.black.$ : Css.blue.$) };
// Output
const styles = { ...{ display: "df", alignItems: "aic" }, ...(active ? { color: "black" } : { color: "blue" }) };
```

### `Css.props`

```ts
// Input
const attrs = { ...Css.props(Css.blue.$) };
// Output
const attrs = { ...trussProps({ color: "blue" }) };
```

### Conditionals

```ts
// Input
const s = Css.if(isActive).df.else.db.$;
// Output
const s = { ...(isActive ? { display: "df" } : { display: "db" }) };
```
