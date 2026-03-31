<p align="center" style="padding: 100px">
  <img src="logo.svg" width="400" />
</p>

<div align="center">
  <img src="https://img.shields.io/npm/v/@homebound/truss" />
  <img src="https://circleci.com/gh/homebound-team/truss.svg?style=svg" />
  <hr />
</div>

Truss is a TypeScript DSL for writing utility CSS (think Tailwinds or Tachyons) in React/JSX.

## Quick Example

Writing Truss code looks like:

```tsx
import { Css } from "src/Css.ts";

function App() {
  return (
    <h1 css={Css.f24.black.$}>Truss v2</h1>

    <p css={Css.bodyText.$}>This demo uses the Truss DSL.</p>

    <div css={Css.df.gap1.$}>
      <div css={Css.p1.ba.bcBlack.br2.cursorPointer.onHover.bcBlue.bgLightGray.$}>
        Border box with padding and radius
      </div>
      <div css={Css.bgBlue.white.p1.br2.cursorPointer.onHover.bgBlack.$}>
        Blue background with white text
      </div>
    </div>
  );
}
```

Which our Vite/esbuild plugins compile to production HTML output:

```html
<h1 class="f24 black">Truss v2</h1>

<p class="f14 black">This demo uses the Truss DSL.</p>

<div class="df gap1">
  <div class="pt1 pb1 pr1 pl1 bss bw1 bcBlack h_bcBlue br2 cursorPointer h_bgLightGray">
    Border box with padding and radius
  </div>
  <div class="bgBlue h_bgBlack white pt1 pb1 pr1 pl1 br2 cursorPointer">Blue background with white text</div>
</div>
```

And a static, build-time generated CSS file:

```css
.df {
  display: flex;
}
.black {
  color: black;
}
.pt1 {
  padding-top: 8px;
}
.bcBlack {
  background-color: black;
}
.h_bcBlue:hover {
  background-color: blue;
}
```

## Quick Features

- Inline CSS-in-JS that is build-time compiled to a single static CSS stylesheet:
  - `<div css={Css.mt1.black.$}>` -> `<div class="mt1 black">`
  - Zero runtime overhead for static styles 🚀
  - Vite plugin emits a single `truss-(contenthash).css`, for optimal caching and performance
  - Homebound's main 400k LOC React SPA has a 100kb uncompressed `truss.css` file

- Naturally use dynamic values:
  - `Css.mt(someValue).$` or
  - `Css.bgColor(maybe ? Palette.Black : Palette.Blue).$` or
  - `Css.mt0.if(someCondition).mt4.$`.
  - Still compiled to static/atomic CSS, with a lightweight runtime helper to apply dynamic values

- Pseudo-selectors and breakpoints:
  - `Css.white.onHover.black.$` or
  - `Css.ifSm.mx1.$`
  - Intentionally limited to "only styling yourself"--discourages "styling at a distance" that breaks encapsulation
  - See the "Pseudo-Selectors" section below for rationale & escape hatches

- `Css` expressions are "just POJOs" that natural compose
  - `<div css={{ ...Css.mt2.$, ...(someCondition ? Css.bgRed.$ : Css.bgGreen.$) }} />`
  - The last-set value _per property_ wins, i.e. not "the last class name"
  - Extremely natural to build up complex styles with conditionals, view logic, etc.

- Tachyons-inspired abbreviations for superior inline readability
  - No long class names that compound into a "wall of text"
  - No IDE plugins needed to make your JSX readable again 😅
  - Consistent `FooBar` -> `fb` abbreviation pattern:
    - `justify-content: flex-start` is `jcfs`
    - Easier to memorize/read
  - See [Why Tachyons](#why-tachyons-instead-of-tailwinds)

- Configure your design system in Truss's configuration 🧑‍🎨
  - Color palette, fonts, increments, and breakpoint 🎨s
  - [See example config](https://github.com/homebound-team/truss/blob/main/packages/template-tachyons/truss-config.ts) and the "Customization" section below

- Escape hatch to arbitrary/runtime selectors
  - `useRuntimeStyle({ body: Css.blue.$ })`
  - Only applied when the component is mounted

- Type-checking built in 💪
  - No editor support or IDE extensions required for great DX
  - Just regular TypeScript (...with code-generation & build-time Vite plugins)

And the elephant 🐘 in the room:

- Why not Tailwinds?
  - Our abbreviations are shorter 🩳
  - Composing styles with POJO spreads instead of class name strings is more ergonomic
  - Easier escape hatches to dynamic values & dynamic selectors
  - "Modifier chains" of `ifSm.blue.p2.m2` is more succinct than repeating class name modifiers
  - We just like Truss better 🤷 😀

- Why not StyleX?
  - StyleX uses arrays/array spreads for runtime composition instead of objects, which did not work for our legacy Truss v1 codebases
  - Too strict with no escape hatches for dynamic/transient CSS/selectors, which are rare but still occur
  - ...but we heavily crib StyleX's atomic CSS priority system 🙏

Also see the "Why This Approach?" section for more rationale.

## Quick How It Works

Truss uses your project's `truss-config.ts` to generate a `src/Css.ts` file with the configured abbreviations/design system in a TypeScript DSL.

This file exports a `Css` symbol that you use like:

```typescript
import { Css } from "src/Css";

const css = Css.mx2.black.$;
```

Where `Css.` signals "the start of your CSS expression", and `.$` signals "the end of your CSS expression".

In between, you can chain as many abbreviations/methods as you want, and they will all be statically typed and compiled into atomic CSS classes at build time.

These expressions are rewritten to be "just plain objects":

```typescript
// Input
const css = Css.mx2.black.$;
// Output
const css = { marginLeft: "ml2", marginRight: "mr2", color: "black" };
```

When every value in the expression is static (no runtime variables or conditionals), the plugin resolves the class names at build time with zero runtime overhead:

```tsx
// Input
return <div css={Css.df.aic.black.$}>content</div>;
// Build-time output — no runtime call, just a plain className
return <div className="df aic black">content</div>;
```

When the expression contains dynamic values, a lightweight `trussProps` runtime helper is used:

```tsx
// Input
return <div css={Css.mt(someValue).black.$}>content</div>;
// Build-time output
return (
  <div {...trussProps({ marginTop: ["mt_var", { "--marginTop": __maybeInc(someValue) }], color: "black" })}>
    content
  </div>
);
```

## Installation

For web usage, use the `truss` command to generate the `Css.ts` (and `Css.json` metadata file) from your `truss-config.ts`:

- `npm i --save-dev @homebound/truss`
- Add a `truss` command to your `package.json`:
  ```json
  {
    "scripts": {
      "truss": "truss"
    }
  }
  ```
- Copy/paste an initial [truss-config.ts](https://raw.githubusercontent.com/homebound-team/truss/main/packages/template-tachyons/truss-config.ts) into your project
  - `wget https://raw.githubusercontent.com/homebound-team/truss/main/packages/template-tachyons/truss-config.ts`
- Run `npm run truss`
  - Re-run `npm run truss` anytime you change `truss-config.ts`
- Start using `Css.mt1.etc.$` in your project and wire `trussPlugin(...)` in Vite (see setup below)

We recommend checking the `src/Css.ts` file into your repository, with the rationale:

- Your design system be pretty stable, so the `Css.ts` output should rarely change.
- When it does change, it can be nice to see the diff-d output in the PR for others to review.
- It's the simplest "just works" setup for new contributors.

### Vite Plugin Setup (pre-compiled libraries)

If you're building a component library with Truss that will be consumed by downstream applications, the recommended approach is to compile the library's `Css.*.$` expressions into a pre-built `truss.css` file that the consuming application's Vite plugin can merge with its own Truss-generated CSS, into a single, unified/deduped `truss.css` output file.

Within the library build, Truss will generate a both `Css.ts` and `Css.json`:

- `Css.ts` is the typed `Css.*.$` DSL to use in your component code,
- `Css.json` is a metadata file consumed by the Truss Vite plugin at build time.

The component library then ships _both_ the `Css.ts` DSL and the `Css.json` metadata file for downstream applications to use for a) styling the application's own components, and then b) creating a unified design system + application code `truss.css` file for production usage.

Within the component library, install the build dependency:

```bash
npm install --save-dev @homebound/truss
```

1. In the **library** package (i.e. your shared, company-wide component library) that defines your Truss styles/design system tokens, run codegen and build with the Truss plugin.

   ```ts
   // truss-config.ts
   export default defineConfig({
     outputPath: "./src/Css.ts",
     // optional: defaults to ./src/Css.json based on outputPath
     mappingOutputPath: "./src/Css.json",
     // ...any palette/fonts/increment/etc configuration...
   });
   ```

   If the library builds with **Vite**, use the Vite plugin:

   ```ts
   // vite.config.ts (library package)
   import { defineConfig } from "vite";
   import { trussPlugin } from "@homebound/truss/plugin";

   export default defineConfig({
     plugins: [trussPlugin({ mapping: "./src/Css.json" })],
     build: {
       lib: {
         /* your library entry */
       },
     },
   });
   ```

   If the library builds with **tsup** (or esbuild), use the esbuild plugin:

   ```ts
   // tsup.config.ts (library package)
   import { defineConfig } from "tsup";
   import { trussEsbuildPlugin } from "@homebound/truss/plugin";

   export default defineConfig({
     entry: ["src/index.ts"],
     esbuildPlugins: [trussEsbuildPlugin({ mapping: "./src/Css.json" })],
   });
   ```

   Both plugins transform `Css.*.$` expressions to plain objects and emit a `truss.css` file with annotations that enable correct merging. `.css.ts` arbitrary-selector rules are also emitted into `truss.css` and preserved as opaque blocks during app-level merges.

   For Vitest, use the Vite plugin:

   ```ts
   // vitest.config.ts (library package)
   import { defineConfig } from "vitest/config";
   import { trussPlugin } from "@homebound/truss/plugin";

   export default defineConfig({
     plugins: [trussPlugin({ mapping: "./src/Css.json" })],
     test: {
       environment: "jsdom",
     },
   });
   ```

   To assert Truss-generated styles in tests, Truss also exports a `toHaveStyle` matcher:

   ```ts
   // testSetup.ts
   import { expect } from "vitest";
   import "@testing-library/jest-dom/vitest";
   import { toHaveStyle } from "@homebound/truss/vitest";

   expect.extend({ toHaveStyle });
   ```

   This gives you both the matcher implementation and Vitest type augmentation. You can then write assertions like:

   ```ts
   expect(element).toHaveStyle({ display: "flex", color: "#353535" });
   ```

2. Publish the library's compiled JS, `Css.json`, and `truss.css` (for example in `dist/`). Then:
   - Application code can import the design system styles directly, e.g. `import { Css } from "@company/library"`.
   - The application does **not** need to run its own Truss codegen step
   - In the application's Vite config, point `mapping` to the library's `Css.json` and `libraries` to the library's `truss.css`:

     ```ts
     import { defineConfig } from "vite";
     import react from "@vitejs/plugin-react";
     import { trussPlugin } from "@homebound/truss/plugin";

     export default defineConfig({
       plugins: [
         trussPlugin({
           // If you don't have a design library, just pass ./src/Css.json
           mapping: "./node_modules/@company/library/dist/Css.json",
           // Pre-compiled CSS from libraries to merge with app CSS
           libraries: ["./node_modules/@company/library/dist/truss.css"],
         }),
         react(),
       ],
     });
     ```

Notes:

- Keep `trussPlugin(...)` before `react()`.
- `mapping` is required and should point to the single `Css.json` you want to compile against.
- `libraries` lists paths to pre-compiled `truss.css` files that will be merged with the app's own generated CSS. Rules are deduplicated by class name and sorted by priority to produce a correct unified stylesheet.

### Plugin Comparison

Truss ships two build plugins. Both transform `Css.*.$` expressions into plain objects and emit a `truss.css` file, but they target different build tools and have different feature sets.

| Feature                   | Vite plugin (`trussPlugin`)                                                       | esbuild plugin (`trussEsbuildPlugin`)                         |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Build tool**            | Vite                                                                              | esbuild / tsup                                                |
| **Use case**              | Applications and Vitest test suites                                               | Library packages compiled with tsup or plain esbuild          |
| **Dev server HMR**        | Yes -- serves CSS via a virtual endpoint and pushes updates over WebSocket        | No -- esbuild has no dev server                               |
| **Content-hashed output** | Yes -- production builds emit `assets/truss-<hash>.css` for long-term caching     | No -- writes a fixed `truss.css` to the output directory      |
| **Library CSS merging**   | Yes -- `libraries` option merges pre-compiled library CSS into the app stylesheet | No -- libraries are merged by the consuming app's Vite plugin |
| **Test CSS injection**    | Yes -- auto-injects CSS into jsdom for Vitest                                     | No                                                            |
| **HTML injection**        | Yes -- injects `<link>` / `<script>` tags into `index.html`                       | No -- not applicable for library builds                       |

**When to use which:**

- **`trussPlugin`** -- Use for any Vite-based application or when running tests with Vitest. This is the primary plugin for most projects.
- **`trussEsbuildPlugin`** -- Use when building a shared component library with tsup or esbuild. The library's emitted `truss.css` (with priority annotations) is then consumed by the application's Vite plugin via the `libraries` option.

### React Native (experimental/mobile) Usage

If you are targeting React Native instead, set `target: "react-native"` in your `truss-config.ts` (and typically `defaultMethods: "tachyons-rn"`).

## Pseudo-Selectors and Media Queries

Truss intentionally limits the selectors you can use in `Css.*.$` chains to:

- 1. Keep atomic class output deterministic,
- 2. Discourage selectors that "reach into other components" to manipulate their styles

Such that, in canonical Truss usage, you can only use selectors that _directly modify the element you're styling_, i.e.:

- `Css.onHover` -> when I'm hovered, modify my styles
- `Css.when(marker, "ancestor", ":hover")` -> when my ancestor is hovered, modify my styles

Unlike Tachyons and Tailwinds, Truss does not create duplicate/repetitive abbreviations for every pseudo-selector and breakpoint variant (e.g. `md-blue` or `lg-red`).

Instead, Truss provides chain commands like `onHover`, `ifSm`, and `ifMd` that then "modify" the commands that come after them:

```tsx
function MyReactComponent(props: {}) {
  // Default is mx2/black.
  // ...unless hovered, then blue
  // ...unless hovered & small screen, then blue & mx1
  return <div css={Css.mx2.black.onHover.blue.ifSm.mx1.$}>...</div>;
}
```

Where `sm` resolves from the breakpoints you define in `truss-config.ts`.

The available pseudo-class modifiers are:

| Modifier         | CSS Pseudo-Class |
| ---------------- | ---------------- |
| `onHover`        | `:hover`         |
| `onFocus`        | `:focus`         |
| `onFocusVisible` | `:focus-visible` |
| `onFocusWithin`  | `:focus-within`  |
| `onActive`       | `:active`        |
| `onDisabled`     | `:disabled`      |
| `ifFirstOfType`  | `:first-of-type` |
| `ifLastOfType`   | `:last-of-type`  |

For arbitrary pseudo-selectors not covered above, use `when`:

```tsx
// Simple pseudo-selector
<div css={Css.when(":hover:not(:disabled)").black.$} />;

// Marker-based relationship (react to an ancestor's hover)
const row = Css.newMarker();
<tr css={Css.markerOf(row).$}>
  <td css={Css.when(row, "ancestor", ":hover").blue.$}>...</td>
</tr>;
```

### Chaining Modifiers

Truss reads `Css...$` chains left-to-right.

Conditions accumulate by "axis", and only the latest modifier on the same axis replaces the previous one.

The available axes are:

| Modifier                               | Description                         |
| -------------------------------------- | ----------------------------------- |
| `if(cond)` / `else`                    | Starts a runtime boolean branch     |
| `ifSm`, `ifMd`, `if("@media ...")`     | Sets the active media-query         |
| `onHover`, `onFocus`, `when(":hover")` | Sets the "this element" selector    |
| `when(marker, "ancestor", ":hover")`   | Sets the "related element" selector |
| `element("::placeholder")`             | Sets the pseudo-element             |

Examples:

```tsx
Css.ifSm.onHover.blue.$;
// small screens && hover => blue

Css.ifSm.if(selected).blue.$;
// small screens && hovered => blue

Css.ifSm.black.else.white.$;
// small screens => black, others => white

Css.ifSm.when(row, "ancestor", ":hover").blue.$;
// small screens && ancestor hovered => blue

Css.when(row, "ancestor", ":hover").onFocus.blue.$;
// ancestor hovered && element focused => blue

Css.onHover.onFocus.blue.$;
// last same-element pseudo wins (:focus)
```

## Arbitrary _Build-time_ Selectors

For selectors not supported by `Css.*.$`, i.e. descendant selectors, `:nth-child(...)`, or library-driven markup hooks, but where the selectors themselves are still:

1. Globally applicable, and
2. Statically known at build-time

You can put the selectors in a `.css.ts` file and then attach the exported class name through `Css.className(...)`.

```ts
// DataGrid.css.ts
import { Css } from "./Css";

export const zebraRows = "zebraRows";

// These styles will be appended to the `truss.css` output
export const css = {
  // Write whatever selectors you want, using `zebraRows`
  [`.${zebraRows} tbody tr:nth-child(even) td`]: Css.bgLightGray.$,
  [`.${zebraRows} tbody tr:hover td`]: Css.bgBlue.white.$,
  // Or do global selectors if you want, but be careful with specificity and conflicts
  body: Css.bgWhite.$,
};
```

```tsx
// DataGrid.tsx
import { Css } from "./Css";
import { zebraRows } from "./DataGrid.css.ts";

export function DataGrid() {
  return (
    <table css={Css.w100.className(zebraRows).$}>
      <tbody>{/* rows */}</tbody>
    </table>
  );
}
```

This keeps the base element styling in Truss, i.e. `Css.w100`, while using the `.css.ts` class as the anchor for arbitrary selectors.

At build time, Truss merges both into the final `className` prop.

If you need arbitrary CSS that the `Css.*.$` DSL does not support (e.g. `!important`, custom properties, or vendor-specific values), you can use a raw string literal or the `Css.raw` tagged template as a property value:

```ts
export const css = {
  body: Css.raw`
    margin: 16px;
    background-color: rgba(255, 255, 255, 1);
    color: rgba(53, 53, 53, 1);
    font-size: 14px !important;
    line-height: 20px !important;
  `,
};
```

The `Css.raw` tag is a pass-through (it returns the string as-is at runtime) but signals to IDEs that the template content is CSS, enabling syntax highlighting and autocomplete (similar to styled-components markup).

Raw strings are emitted as-is, so property names must use standard CSS kebab-case (e.g. `font-size`, not `fontSize`).

You can also use a plain string literal or untagged template literal:

```ts
export const css = {
  body: `
    margin: 16px;
    font-size: 14px !important;
  `,
};
```

**Limitations:**

- Only static and literal-argument chains are supported (e.g. `Css.df.$`, `Css.mt(2).$`, `Css.mtPx(12).$`)
- Runtime/variable arguments (`Css.mt(x).$`), conditionals (`Css.if(cond).df.$`), pseudo-class modifiers (`Css.onHover.blue.$`), and media query modifiers (`Css.ifSm.blue.$`) are not supported

## Arbitrary _Runtime_ Selectors

When selector rules are either:

- 1. Fundamentally driven by runtime values that change the selector itself, or
- 2. Should be only transiently injecteda/applied while a component is mounted

Truss also provides a `RuntimeStyle` component:

```tsx
import { Css, RuntimeStyle } from "./Css";

function Preview(props: { accent: string }) {
  return (
    <>
      <RuntimeStyle
        css={{
          ".preview [data-selected='true']": Css.bc(props.accent).bgWhite.$,
        }}
      />
      <div className="preview">...</div>
    </>
  );
}
```

`RuntimeStyle` evaluates its `Css` expressions at runtime, injects a `<style>` tag into the DOM, and removes that tag when the component unmounts. Use it for ephemeral selectors or selector rules that depend on runtime values; use `.css.ts` when the rule is static/global and should be baked into the build output.

The same behavior is available as the `useRuntimeStyle` hook for cases where you prefer a hook over a component:

```tsx
import { Css, useRuntimeStyle } from "./Css";

function Preview(props: { bottomMargin: number }) {
  useRuntimeStyle({ body: Css.mbPx(props.bottomMargin).$ });
  return <div>...</div>;
}
```

## `Css.className(...)` and `Css.style(...)`

For the occasional case where a `Css.*.$` chain needs to attach a raw `className` or inline `style`, Truss provides two build-time passthrough helpers:

- `Css.className(value)` appends one or more raw classes to the final element
- `Css.style(value)` appends raw inline styles to the final element's `style` prop

Example:

```tsx
const iconVars = {
  "--icon-primary": color,
  "--icon-secondary": secondaryColor,
  "--icon-stroke": color,
};

return <div css={Css.blue.mt(getMargin()).className("my-icon").style(iconVars).$} />;
```

Which compiles to output equivalent to:

```tsx
return (
  <div
    className="my-icon blue mt_var"
    style={{
      "--marginTop": getMargin(),
      ...iconVars,
    }}
  />
);
```

Typical use cases are:

- `Css.className(...)` for attaching a class exported from a `.css.ts` file or a third-party class hook
- `Css.style(...)` for custom CSS variables or a small amount of inline style data that should travel with the element

These are intentionally escape hatches:

- they only work in normal build-time `css={...}` expressions
- they are not supported inside `RuntimeStyle` / `useRuntimeStyle`
- they are not supported in `.css.ts` arbitrary-selector rules
- they cannot be used inside modifier contexts like `ifSm`, `onHover`, `when(...)`, or `element(...)`

## Truss Command

The truss command accepts an optional second argument which is the path to your
configuration file. If omitted, it will look for `./truss-config.ts`.

```json
{
  "scripts": {
    "truss": "truss path/to/configuration/file.ts"
  }
}
```

## Configuration

Truss's configuration is done via a `truss-config.ts` file installed into your local project.

See the comments in [that file](https://raw.githubusercontent.com/homebound-team/truss/main/packages/template-tachyons/truss-config.ts) for the available config options. For example setting up your custom font abbreviations is set via a `FontConfig` hash:

```
// Defines the typeface abbreviations, the keys can be whatever you want
const fonts: FontConfig = {
  f10: "10px",
  f12: "12px",
  f14: "14px",
  f24: "24px",
  // Besides the "24px" shorthand, you can define weight+size+lineHeight tuples
  tiny: { fontWeight: 400, fontSize: "10px", lineHeight: "14px" },
};
```

Also see the [Customization](#customization) section for more advanced configuration options.

## Pseudo-Selectors and Media Queries

Unlike Tachyons and Tailwinds, Truss does not create duplicate/repetitive abbreviations for every pseudo-selector and breakpoint variant (e.g. `md-blue` or `lg-red`).

Instead, Truss provides chain commands like `onHover`, `ifSm`, and `ifMd` that then "modify" the commands that come after them:

```tsx
function MyReactComponent(props: {}) {
  return <div css={Css.mx2.black.onHover.blue.ifSm.mx1.$}>...</div>;
}
```

Where `sm` resolves from the breakpoints you define in `truss-config.ts`.

The available pseudo-class modifiers are:

| Modifier         | CSS Pseudo-Class |
| ---------------- | ---------------- |
| `onHover`        | `:hover`         |
| `onFocus`        | `:focus`         |
| `onFocusVisible` | `:focus-visible` |
| `onFocusWithin`  | `:focus-within`  |
| `onActive`       | `:active`        |
| `onDisabled`     | `:disabled`      |
| `ifFirstOfType`  | `:first-of-type` |
| `ifLastOfType`   | `:last-of-type`  |

For arbitrary pseudo-selectors not covered above, use `when`:

```tsx
// Simple pseudo-selector
<div css={Css.when(":hover:not(:disabled)").black.$} />;

// Marker-based relationship (react to an ancestor's hover)
const row = Css.newMarker();
<tr css={Css.markerOf(row).$}>
  <td css={Css.when(row, "ancestor", ":hover").blue.$}>...</td>
</tr>;
```

See [Chaining Modifiers](#chaining-modifiers) for how boolean `if(...)`, breakpoint `ifSm`, and `when(...)` stack and reset.

## Custom Selectors with `.css.ts` and `Css.className(...)`

For selectors that do not fit naturally into a `Css.*.$` chain, i.e. descendant selectors, `:nth-child(...)`, or library-driven markup hooks, put that selector logic in a `.css.ts` file and then attach the exported class name through `Css.className(...)`.

```ts
// DataGrid.css.ts
import { Css } from "./Css";

export const zebraRows = "zebraRows";

export const css = {
  [`.${zebraRows} tbody tr:nth-child(even) td`]: Css.bgLightGray.$,
  [`.${zebraRows} tbody tr:hover td`]: Css.bgBlue.white.$,
};
```

```tsx
// DataGrid.tsx
import { Css } from "./Css";
import { zebraRows } from "./DataGrid.css.ts";

export function DataGrid() {
  return (
    <table css={Css.w100.className(zebraRows).$}>
      <tbody>{/* rows */}</tbody>
    </table>
  );
}
```

This keeps the base element styling in Truss, i.e. `Css.w100`, while using the `.css.ts` class as the anchor for arbitrary selectors. At build time, Truss merges both into the final `className` prop.

## XStyles / Xss Extension Contracts

Truss liberally borrows the idea of type-checked "extension" CSS from the currently-unreleased Facebook XStyles library (at least in theory; I've only seen one or two slides for this feature of XStyles, but I'm pretty sure Truss is faithful re-implementation of it).

As context, when developing components, you often end up with "properties that are okay for the caller to set" (i.e. that you as the component developer support the caller setting) and "properties that are _not_ okay for the caller to set" (i.e. because the component controls them).

Basically, you want to allow the caller to customize _some_ styles of the component, typically things like color or margin or font size, but not give them blanket control of "here is a `className` prop, do whatever you want to my root element", which risks "radical"/open-ended customization that then you, as the component developer, don't know if you will/will not unintentionally break going forward.

(I.e. see [Layout isolated components](https://visly.app/blog/layout-isolated-components) for a great write up of "parents control margin, components control padding".)

With Truss, you can explicitly declare a contract of styles allowed to be set on your component, i.e.:

```tsx
import { Css, Only, Xss } from "src/Css";

// Declare the allowed/supported styles
export type DatePickerXss = Xss<"marginLeft" | "marginRight">;

// Update the props to accept an `xss` prop to accept the customizations
export interface DatePickerProps<X> {
  date: Date;
  xss?: X;
}

// Use the `Only` type to ensure `xss` prop is a subset of DatePickerXss
export function DatePicker<X extends Only<DatePickerXss, X>>(props: DatePickerProps<X>) {
  const { date, xss } = props;
  // The component controls marginTop/marginBottom, and defers to the caller for marginLeft/marginRight
  return <div css={{ ...Css.my2.$, ...xss }}>{date}</div>;
}
```

Here we're allowing callers to set `marginLeft` or `marginRight`, i.e. this line will compile because `mx2` is statically typed as `{ marginLeft: number; marginRight: number }`, and so is a valid `xss` value:

```tsx
<DatePicker xss={Css.mx2.$} date={...} />
```

However, this line will not compile because `mt2` is statically typed as `{ marginTop: number }`, and `marginTop` is not allowed by `DatePickerXss`:

```tsx
<DatePicker date={...} xss={Css.mt2.$} />
```

The `Css` DSL also iteratively types itself, i.e. `Css.ml1.mr2.$` is still statically typed as `{ marginLeft: number; marginRight: number }`, instead of being based just on the last-used abbreviation.

You can also destructure an `xss` value for component logic, and then re-apply specific overrides with `addCss(...)`. A useful pattern is to put the component's fallback/default earlier in the chain, and let the caller's destructured override win later:

```tsx
import { Css, type Only, type Xss } from "src/Css";

type PanelXss = Xss<"color" | "height">;

function Panel<X extends Only<PanelXss, X>>(props: { xss?: X }) {
  const xss = props.xss as Partial<PanelXss> | undefined;
  const { height } = xss ?? {};

  return <div css={Css.h(1).black.addCss({ height }).$}>panel</div>;
}
```

In this example, `Css.h(1)` provides the default height, and `addCss({ height })` only overrides it when the caller actually passed a `height` xss value.

This is very similar to doing a spread on `...{ height }` but note that, if the spread height is `undefined`, this will drop any previous `height` values--the `addCss` method will noticed the `undefined` and skip it.

Truss conventionally uses the `xss` prop name for "the component's allowed extension styles" as a play on the `css` prop name, with the `x` representing the "extension" concept, but otherwise there is nothing special about the name of the `xss` prop.

Also note that the XStyles/Xss feature is completely opt-in; you can use it if you want, or you can use Truss solely for the `Css.m2.black.$` abbreviations.

## Customization

Truss supports several levels of customization:

1. Per-project fonts/colors/etc. in `truss-config.ts`
2. Per-project rule additions or changes in `truss-config.ts`
3. Forking

### Per-Project Fonts/Colors/Etc

Each project that uses Truss gets a local `index.ts`, checked into its repo essentially as a config file, that defines in TypeScript the core settings, i.e.:

```typescript
const increment = 8;
const numberOfIncrements = 4;

const palette = {
  Black: "#353535",
  MidGray: "#888888",
  LightGray: "#cecece",
  White: "#fcfcfa",
  Blue: "#526675",
};

const fonts = {
  f24: "24px",
  f18: "18px",
  f16: "16px",
  f14: "14px",
  f12: "12px",
  // Can also set multiple properties if necessary
  f10: { fontSize: "10px", fontWeight: 500 },
};

const breakpoints = { sm: 0, md: 600, lg: 960 };

// ...rest of the config file...
```

Projects should heavily customize these settings to match their project-specific design system, then run `npm run truss` to get an updated `Css.ts`, i.e. after adding `Green: "green"` as a color in `palette`, the `Css.ts` file will automatically have utility methods added like:

```typescript
  get green() { return this.add("color", "green"); }
  get bgGreen() { return this.add("backgroundColor", "green"); }
  get bGreen() { return this.add("borderColor", "green"); }

```

### Per-Project Utility Methods

In the same `index.ts`, projects can add their own new abbreviations/utility methods:

```typescript
const sections = {
  ourSection: () => [newMethod("someAbbreviation", { color: "#000000" })],
};
```

Will result in `Css.ts` having a line that looks like:

```typescript
  // ourSection
  get someAbbreviation() { return this.add("color", "#000000"); }
```

Which can then be used as `Css.m2.someAbbreviation.$`.

Besides adding one-off additional methods, if your project wants to replace a whole section of Truss's out-of-the-box methods, you can do this via:

```typescript
const sections = {
  // Prefer app-specific border radiuses
  borderRadius: () =>
    newMethodsForProp("borderRadius", {
      br4: "4px",
      br8: "8px",
      br16: "16px",
    }),
};
```

Where `borderRadius` matches the name of the section in Truss's [sections](https://github.com/homebound-team/truss/tree/main/src/sections) directory (which generally matches Tachyon's organization).

### Forking

At the end of the day, Truss is small and hackable such that forking it to make the abbreviations "strict Tachyons" or "strict Tailwinds" or "whatever best fits your project/conventions/styles" should be easy and is kosher/encouraged.

The core Truss feature of "make a TypeScript DSL with a bunch of abbreviations" is also basically done, so it's unlikely you will miss out on some future/forthcoming amazing features by forking.

And, even if so, the coupling between Truss and your application code is limited to the `Css.abbreviations.$` lines that should be extremely stable even if/as the core of Truss evolves.

## Why This Approach?

Truss's approach is "Tachyons-ish" (or Tailwinds-ish), insofar as having short/cute utility class definitions.

On web, those abbreviations compile through the Truss Vite plugin into atomic CSS classes. On mobile, they resolve to plain React Native style objects.

The benefits of this approach are:

- We get the brevity + "inline-ness" of Tachyons/Tailwinds.

- It delivers critical CSS, i.e. we don't need the large static TW/Tachyons CSS files.

  (My reading of projects like [tachyons-styled-react](https://github.com/tachyons-css/tachyons-styled-react), from the creator of Tachyons, is that critical-ness is still important goal/improvement even for static-utility-class approaches like Tachyons.)

- Pseudo-selectors/breakpoints go through Truss's typed DSL (`onHover`, `ifSm`, etc.), which keeps usage concise and reduces method/abbreviation bloat.

  I.e. we don't need to suffix `-nl` for "not large" onto every single abbreviation.

- You can still mix in regular CSS for the places where utility abbreviations are not the best fit (see `.css.ts` files).

- Projects can easily tweak their preferred styles/abbreviations.

  Granted, this is very similar in spirit to Tailwinds customization, but for Truss, the config process is "just change some TypeScript code and run `generate`", and doesn't involve any changes to your build/webpack/PostCSS/etc. setup.

## Why Tachyons Instead of Tailwinds?

tldr: Tachyon's abbreviations are shorter. :-)

For example, the CSS `justify-content: flex-start` in Tailwinds is `justify-start`, and in Truss is `jcfs` (i.e. the Justify Content Flex Start).

This is admittedly preference, but Truss's assertion is that **readability goes up when code sprawl goes down**, because you can visually fit more code into view at once.

And so Tachyons-style abbreviations, even if each abbreviation in isolation is more complex, when taken as a whole (looking at 10-20 lines of non-trivially-styled JSX) is arguably more readable.

Granted, the more-succinct code is still doing "the same work" (setting the same CSS properties) as the longer code, but you are likely only paying attention to a small subset of code at any given time, so the currently-unimportant code/abbreviations will "fade into the background" more easily when they're shorter.

(This is also not to say all names in a codebase should be meaningless chicken-scratch like `a`, `b`, `c`, etc., but when there are very strong/consistent conventions (like loop variables being called `i`, `j`, `k`), then leaning into succinctness can be appropriate.)

All this said, it's very possible to teach Truss how to generate Tailwinds-based abbreviations, we just haven't done it yet; see [this issue](https://github.com/homebound-team/truss/issues/65) if you're interested in helping contribute.

## Themes

The word "theme" can mean either "static themes" (i.e. using the same consistent colors/fonts throughout your app, but the values themselves never really change) or "dynamic themes" (i.e. the user changing from light mode to dark mode).

For static themes, Truss's `index.ts`/`palette.ts` are specifically setup to centrally define your application's fonts, colors, etc. (see the "Configuration" section), so that they are consistently applied through your application.

For dynamic themes, Truss doesn't have any features dedicated explicitly to support them, but you can easily use CSS variables in your methods, i.e.:

```typescript
const palette = {
  Primary: "var(--primary)",
  Secondary: "var(--secondary)",
};
```

And then have your application handle setting the `--primary` / `--secondary` values as appropriate (i.e. by importing a `dark-mode.css` or `light-mode.css` which define the respective CSS variable values).

## Inspiration

Several libraries influenced Truss, specifically:

- [Typed Tailwinds](https://typed.tw) and [babel-plugin-tailwind-components](https://github.com/bradlc/babel-plugin-tailwind-components) are both "type-safe TypeScript utility-css DSLs".

  In particular, the babel-plugin-tailwind-components insight of "if you just make `csstype`-compliant object literals, you can build a typed utility DSL on top" was a very useful/inspirational insight.

- Facebook's [XStyles](https://www.youtube.com/watch?v=9JZHodNR184) for the "typed extension" idea

- Facebook's [StyleX](https://stylexjs.com/) heavily influenced Truss's 2.x build-time approach--i.e. we copied nearly everything about it. 😅

  StyleX solved the hard problems of build-time atomic CSS:
  - property-level last-write-wins semantics,
  - specificity tiers via doubled selectors for media queries,
  - CSS custom properties for runtime values, and
  - deterministic class generation.

  The only reasons we don't use StyleX directly are:
  - The `stylex.create` values are "arrays of tuple data", instead of object hashes, and so didn't work with Truss's extremely common object literal spreads of `css={{ ...Css.mt2.$, ...someOtherStyles }}`.

  - Given we already have "basically unique" abbreviations, we can make class names that aren't esoteric hashes.

    We probably give up some small-percentage of output size/performance, that matters at Facebook scale, but for Truss we prioritize readability and debuggability of the emitted CSS classes.

## Contributing

The Truss repository is set up as a Yarn workspace, although the core package is just `packages/truss`; the other packages are examples/tests projects.

A basic development flow is:

- In the root directory, run `yarn`
- In the root directory, run `yarn build -w`
- Iterate as you want
- In the root directory, run `yarn test` to run all tests
  - Running individual tests in your IDE/each package should work as well
- In the root directory run `yarn codegen` to generate the testing `Css.ts` files

## Todo

- `npx -p @homebound/truss init` type experience for setup - inspired by [Storybook](https://storybook.js.org/docs/guides/quick-start-guide/)
- Support `number[]` increments as config
