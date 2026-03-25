# New Library + Application Approach

## Problem

The current "compile-in-app" approach requires the consuming application's Vite build to treat library source as untransformed code, processing both the library's `Css.*.$` expressions and the application's own expressions in a single build. This causes significant issues: the application's Vite build must handle the library's CJS/ESM dependencies, which frequently breaks.

## New Approach: Pre-Compiled Libraries

Libraries compile their own JSX and emit a `truss.css` file alongside their compiled JS. The consuming application only transforms its own source files, then merges the library's `truss.css` with its own generated CSS.

This works because Truss's CSS output is **deterministic** -- the same abbreviation always produces the same class name and CSS rule. Two independent builds using the same `Css.json` mapping will produce identical rules for identical abbreviations. Deduplication is therefore trivial: same class name = same rule.

## Key Design: Priority Annotations

The trickiest part of merging two `truss.css` files is preserving the correct priority order. Truss uses CSS source order within specificity tiers to determine cascade winners (e.g., `:active` beats `:hover` because it appears later).

To enable correct merging, the CSS output includes **priority annotations** as comments:

```css
/* @truss p:3000 c:df */
.df {
  display: flex;
}
/* @truss p:3130 c:h_blue */
.h_blue:hover {
  color: #526675;
}
/* @truss p:3200 c:sm_blue */
@media screen and (max-width: 599px) {
  .sm_blue.sm_blue {
    color: #526675;
  }
}
/* @truss @property */
@property --marginTop {
  syntax: "*";
  inherits: false;
}
```

- `p:<number>` is the exact priority from `computeRulePriority()`, determining sort order
- `c:<name>` is the class name, used for deduplication
- `@property` declarations are tagged separately and always appear at the end

## Merge Algorithm

1. Parse each library `truss.css`: extract `(priority, className, cssText)` tuples
2. Convert the app's `cssRegistry` rules into the same format
3. Combine all rules, dedupe by class name (keep first occurrence since they're identical)
4. Sort by priority ascending, tiebreak alphabetically by class name
5. Collect all `@property` declarations, dedupe, append at end
6. Emit unified CSS

## Library Setup

```ts
// Library truss-config.ts
export default defineConfig({
  outputPath: "./src/Css.ts",
  // ...palette/fonts/increment/etc
});

// Library vite.config.ts (or similar build tool config)
export default defineConfig({
  plugins: [
    trussPlugin({ mapping: "./src/Css.json" }),
    // ...other build plugins
  ],
});
```

The library ships: **compiled JS** (expressions transformed to plain objects), **Css.json** (so apps can use the same `Css` DSL), and **truss.css** (with priority annotations).

## Application Setup

```ts
// Application vite.config.ts
import { trussPlugin } from "@homebound/truss/plugin";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    trussPlugin({
      mapping: "./node_modules/@company/library/dist/Css.json",
      libraries: ["./node_modules/@company/library/dist/truss.css"],
    }),
    react(),
  ],
});
```

The `libraries` option points to pre-compiled `truss.css` files that will be merged with the app's own generated CSS. No `externalPackages` needed -- the library's JS is already compiled.

## Changes

| File                   | Change                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| `emit-truss.ts`        | Add priority annotations to CSS output                             |
| `merge-css.ts`         | **New** -- parse & merge annotated CSS files                       |
| `index.ts` (plugin)    | Add `libraries` option, remove `externalPackages`, integrate merge |
| `index.test.ts`        | Remove externalPackages tests, add annotation/merge tests          |
| `merge-css.test.ts`    | **New** -- tests for merge logic                                   |
| `vite.config.ts` (app) | Update example config                                              |
| `README.md`            | Update library setup docs                                          |
| `docs/overview.md`     | Minor updates                                                      |

## Removed: `externalPackages`

The `externalPackages` option is removed entirely. It was the mechanism for the compile-in-app approach, which is no longer needed. Libraries should pre-compile their own CSS.
