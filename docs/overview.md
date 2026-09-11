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
Css.mt(x).$ → { marginTop: ["mt_var", { "--marginTop": maybeCssVar(__maybeInc(x)) }] }
```

The tuple format is `[classNames: string, vars: Record<string, string>]`. At runtime, `trussProps` splits this into `className: "mt_var"` and `style: { "--marginTop": "16px" }`.

When the argument is a literal, the value is evaluated at build time into a static class:

```ts
Css.mt(2).$ → { marginTop: "mt_2" }        // .mt_2 { margin-top: calc(var(--t-spacing) * 2) }
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

Markers are deterministic CSS classes applied to elements. `when(selector)` targets the current element, and `when(marker, relationship, pseudo)` compiles to CSS relationship selectors:

```ts
Css.marker.$                              → { __marker: "_mrk" }
Css.markerOf(row).$                       → { __marker: "_row_mrk" }
Css.when(":hover:not(:disabled)").blue.$  → { color: "h_n_d_blue" }
Css.when(marker, "ancestor", ":hover").blue.$ → { color: "wh_anc_h_blue" }
Css.when(row, "descendant", ":focus").blue.$               → { color: "wh_desc_f_row_blue" }
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

1. **Chain extraction** — `transform.ts` parses the file, finds `Css.*.$` chains, and resolves each chain into typed segments via `resolve-chain.ts` and its `resolve-*` helpers.
2. **CSS rule collection** — `emit-css.ts` (`collectAtomicRules`) processes segments into a global `Map<string, AtomicRule>`. Each atomic rule maps one class name to one CSS selector + declaration pair; `style-entries.ts` derives the class names.
3. **AST rewriting** — `rewrite-sites.ts` replaces each `Css.*.$` expression with an object expression (`{ display: "df", ... }`) built by `emit-style-hash.ts`, and rewrites JSX `css=` props into `trussProps(...)` or `mergeProps(...)` calls.
4. **CSS text generation** — `emit-css.ts` (`generateCssText`) serializes collected rules into CSS text, ordered by specificity tiers.

### Key source files

| File                 | Role                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `transform.ts`       | Entry point — orchestrates parsing, chain resolution, rewriting, output                             |
| `resolve-chain.ts`   | Walks a `Css.*.$` chain, tracking the condition context and splitting at `if()`/`else`              |
| `resolve-*.ts`       | Resolve individual chain nodes: entries, calls (`add`, `with`, ...), `setVar`, `typography`, `when` |
| `types.ts`           | `ResolvedSegment` union (static, variable, className, inlineStyle, composed, typography, error)     |
| `style-entries.ts`   | Turns CSS segments into class names and `StyleEntry` records shared by both emitters                |
| `emit-css.ts`        | Atomic rule collection and CSS text generation                                                      |
| `emit-style-hash.ts` | Builds style hash object expressions and the injected helper declarations                           |
| `rewrite-sites.ts`   | Rewrites expression sites — objects, JSX props, `Css.props()` calls                                 |
| `runtime.ts`         | Runtime exports: `trussProps`, `mergeProps`, `TrussDebugInfo`                                       |
| `merge-css.ts`       | Parses and merges annotated truss.css files from libraries                                          |
| `index.ts`           | Vite plugin — global CSS registry, dev HMR, production CSS emission                                 |

### Dev mode

The plugin serves collected CSS via a virtual endpoint (`/virtual:truss.css`) and uses Vite's HMR to push updates. A virtual runtime script creates a `<style>` tag and re-fetches CSS on `truss:css-update` events. No per-file CSS injection is needed in the browser.

For jsdom tests, the plugin passes `injectCss: true`, which injects `__injectTrussCSS(payload)` calls into each transformed file. This single structured payload carries atomic rules with priority, class name, CSS text, and optional at-rule metadata, plus property registrations when needed. The library bootstrap adds its source, order, and spacing prelude; arbitrary `.css.ts` modules supply complete top-level CSS rules split at compile time and a canonical source path. The runtime deduplicates atomic rules by class and inserts them into one CSSOM stylesheet with the same priority, query-width, and class-name ordering as production. It does not parse Truss annotations or use temporary stylesheets to split CSS. The annotated `truss.css` disk format remains unchanged and is parsed only by build-time tooling. A late module can add an earlier-priority rule without reparsing existing rules or moving static CSS after mounted runtime styles.

A virtual test bootstrap supplies library CSS and the root spacing variable. Application modules and `.css.ts` files deliver their own CSS when loaded, including dynamic imports; the bootstrap does not need to discover the entire module graph. Arbitrary CSS follows atomic rules and property declarations: library blocks retain configured library order, and application blocks use canonical source-path order in both tests and production. This makes application block precedence independent of import order.

The static registry lives on the style element for the document lifetime and survives runtime module reloads. Component unmounts only remove their transient `useRuntimeStyle` sheets. The injection helper accepts only structured payloads, with spacing passed explicitly as a prelude. Arbitrary selectors remain supported: build-time tooling splits `.css.ts` and library blocks with css-tree while preserving nested rules and stylesheet parser recovery. The runtime refreshes jsdom's computed-style cache only when the sheet changes and tolerates unsupported property and arbitrary at-rules, which text-based stylesheet parsing already ignores. Repeated registrations use class, variable, and source identities for dedupe, not object identity or whole-payload stringification.

### Production mode

The plugin accumulates all atomic rules across files during transform. In `generateBundle`, it merges the app's rules with any pre-compiled library `truss.css` files (configured via the `libraries` option), deduplicates by class name, sorts by priority, and appends the unified CSS to an existing CSS asset or emits a standalone `truss.css`. The `writeBundle` hook writes to disk as a fallback.

### Library CSS merging

Each CSS rule in the output is annotated with its priority: `/* @truss p:<priority> c:<className> */`. When `libraries` are configured, the plugin parses these annotations from each library's `truss.css`, combines them with the app's own rules, deduplicates by class name (same class name = same rule, since output is deterministic), and sorts them with the same comparator the per-file emitter uses: priority, then media-query width, then class name. Library definitions take precedence if a class conflicts with an application definition. `@property` declarations are deduplicated by variable name and appended before arbitrary CSS blocks.

## CSS Generation

### Naming strategy

Class names are deterministic and human-readable:

| Pattern                   | Example class                | CSS                                                                                            |
| ------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Base                      | `df`                         | `.df { display: flex }`                                                                        |
| Pseudo-class              | `h_blue`                     | `.h_blue:hover { color: #526675 }`                                                             |
| Media query               | `sm_df`                      | `@media (...) { .sm_df.sm_df { display: flex } }`                                              |
| Media + pseudo            | `sm_h_blue`                  | `@media (...) { .sm_h_blue.sm_h_blue:hover { ... } }`                                          |
| Raw media/container query | `media_min_width_600px_blue` | `@media (min-width: 600px) { .media_min_width_600px_blue.media_min_width_600px_blue { ... } }` |
| Pseudo-element            | `placeholder_blue`           | `.placeholder_blue::placeholder { color: #526675 }`                                            |
| Variable                  | `mt_var`                     | `.mt_var { margin-top: var(--marginTop) }`                                                     |
| Literal-evaluated         | `mt_2`                       | `.mt_2 { margin-top: calc(var(--t-spacing) * 2) }`                                             |
| `add()` literal           | `tsn_all_240ms`              | `.tsn_all_240ms { transition: all 240ms }`                                                     |
| `add()` variable          | `color_var`                  | `.color_var { color: var(--color) }`                                                           |
| `when()` relationship     | `wh_anc_h_blue`              | `._mrk:hover .wh_anc_h_blue { color: #526675 }`                                                |

### Specificity tiers

The stylesheet uses specificity tiers so cascade behavior is correct regardless of source order:

| Tier                  | Specificity | Selector pattern      | Example                                |
| --------------------- | ----------- | --------------------- | -------------------------------------- |
| Base                  | `(0,1,0)`   | `.class`              | `.black { color: #353535 }`            |
| Pseudo-class          | `(0,1,1)`   | `.class:pseudo`       | `.h_blue:hover { color: #526675 }`     |
| Pseudo-element        | `(0,1,1)`   | `.class::element`     | `.placeholder_blue::placeholder {...}` |
| Relationship (`when`) | `(0,2,0)+`  | combinator selectors  | `._mrk:hover .target { ... }`          |
| Media query           | `(0,2,0)`   | `.class.class`        | `.sm_blue.sm_blue { ... }`             |
| Media + pseudo        | `(0,2,1)`   | `.class.class:pseudo` | `.sm_h_blue.sm_h_blue:hover { ... }`   |

The doubled selector for media queries follows the same approach StyleX uses — it bumps specificity to `(0,2,0)` so media rules always beat base rules when the query matches, regardless of source order.

### Condition precedence

Within the same specificity tier, CSS source order determines the winner. Truss defines fixed global ordering tables:

**Pseudo-class precedence** (weakest to strongest): `:hover` → `:focus` → `:focus-visible` → `:active` → `:disabled`

**Media precedence**: Rules with the same priority are ordered by the px width interval their query matches, widest first, so the narrower query is emitted later and wins wherever both match. Min-width queries sort ascending, then max-width queries descending, then two-sided ranges such as `ifMd`, then queries with no readable width (`ifPrint`, `not`, comma lists). Class name is the final tiebreak. I.e. `ifMdAndUp.white.ifLg.black` emits `mdandup_white` before `lg_black`, so black wins at 960px and up. `@container` queries follow the same rule.

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

## StyleX Spread Problem

An example of the spread problem, we would write:

```tsx
const a = Css.df.$;
const b = Css.mt2.$;
// And then later:
return <div css={{ ...a, ...b }} />;
```

Which the original StyleX-backend would rewrite into:

```tsx
const styles = stylex.create({
  df: { display: "flex" },
  mt2: { marginTop: "16px" },
});

const a = [css.df];
const b = [css.mt2];
// And then later:
return <div css={{ ...a, ...b }} />;
```

And the _object_ spread of `...a, ...b` would treat a/b "as objects", using the indexes as the keys and so build:

```ts
const css = { 0: css.df };
```

Ideally we could "just" rewrite this to:

```tsx
return <div css={[...a, ...b]} />;
```
