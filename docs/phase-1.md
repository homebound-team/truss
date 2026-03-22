# Phase 1: Transform Pipeline

## Goal

Replace the StyleX-based transform output with Truss-native style hashes and CSS generation. After this phase, `transformTruss()` produces the new object-based output shape and all transform tests pass against the new model.

## Scope

Everything inside `packages/truss/src/plugin/` and `packages/truss/src/runtime.ts` that controls what JS output a transformed file contains.

### In scope

- `runtime.ts` — new `trussProps`, `mergeProps`, `TrussDebugInfo`, `__injectTrussCSS`
- `emit-truss.ts` — replaces `emit-stylex.ts`; generates style-hash AST and CSS text
- `rewrite-sites.ts` — simplified to emit object expressions instead of style arrays
- `transform.ts` — removes StyleX imports, wires in new emitter and runtime imports
- `transform.test.ts` — fully rewritten expectations for new output shape
- All style types: static, dynamic, pseudo-classes, media queries, pseudo-elements
- Debug mode (`TrussDebugInfo` injection)
- Condition precedence tables (pseudo-class ordering, media ordering)
- Specificity tiers (base, pseudo, media doubled-selector, media+pseudo)
- Shorthand expansion to longhands
- `add()` via dynamic class infrastructure
- `Css.props` lowering to `trussProps`

### Out of scope (deferred to Phase 2+)

- Vite plugin HMR (virtual CSS endpoint, runtime script, WebSocket events)
- Production `generateBundle` / `writeBundle` for `truss.css`
- `.css.ts` pipeline updates
- Removing StyleX from `packages/app-stylex` Vite/Vitest config
- Black-box test suite (`Css.test.tsx`) updates
- `marker`, `markerOf`, `when()` (Phase 3)

## Implementation Order

### 1. `runtime.ts`

Standalone — no dependencies on the transform.

Rewrite to export:

- `TrussDebugInfo` class (unchanged)
- `trussProps(...hashes)` — merges style hashes, splits space-separated class names, collects CSS variable maps, emits `data-truss-src` in debug mode
- `mergeProps(className, style, ...hashes)` — merges explicit className/style with trussProps output
- `__injectTrussCSS(cssText)` — jsdom/test helper that writes to a `<style data-truss>` tag

Remove:

- `asStyleArray`
- StyleX `stylex.props()` delegation
- `splitDebugInfo` / `applyDebugSources` (folded into `trussProps`)

Write `runtime.test.ts` to cover:

- Static hash merging and className output
- Dynamic tuple handling (CSS variables in inline style)
- Space-separated class bundles (pseudo/media)
- Debug info collection and `data-truss-src`
- Falsy value filtering
- `mergeProps` with explicit className and style

### 2. `emit-truss.ts`

Replaces `emit-stylex.ts`. Core responsibilities:

**CSS rule registry:**

- Global `Map<string, AtomicRule>` keyed by class name
- Each `AtomicRule` stores: class name, CSS property (kebab-case), value, optional pseudo-class, optional media query, optional pseudo-element
- Deduplication: same class name → same rule, skip

**Class name generation:**

- Base: abbreviation name (e.g. `df`, `black`, `mt_16px`)
- Pseudo suffix: `_h`, `_f`, `_fv`, `_a`, `_d`
- Media suffix: `_sm`, `_md`, `_lg`
- Pseudo-element suffix: `_placeholder`, etc.
- Stacked: `blue_sm_h`
- Dynamic: `mt_dyn`, `bc_dyn_h`
- `add()`: `color_dyn` (reuses dynamic infrastructure)

**CSS text generation:**

- Base: `.df { display: flex }`
- Pseudo: `.blue_h:hover { color: #526675 }`
- Media: `@media (...) { .blue_sm.blue_sm { color: ... } }` (doubled selector)
- Media+pseudo: `@media (...) { .blue_sm_h.blue_sm_h:hover { ... } }`
- Pseudo-element: `.blue_placeholder::placeholder { ... }`
- Dynamic: `.mt_dyn { margin-top: var(--mt_dyn) }` + `@property`
- Ordered by precedence tiers

**AST generation:**

- `buildStyleHashProperties(segments)` → array of Babel `ObjectProperty` nodes for `{ display: "df", color: "black blue_h" }`
- Dynamic entries produce `ArrayExpression` tuples
- `buildMaybeIncDeclaration()` — increment helper (carried forward)
- `collectAtomicRules(sites)` → populates the CSS rule registry
- `generateCssText()` → returns the full CSS string from the registry, ordered by tiers

### 3. `rewrite-sites.ts`

Dramatic simplification. Remove:

- `buildStyleArrayExpression` and all array-building logic
- `flattenStyleObject`, `hasStyleArraySpread`, `expressionContainsArray`
- `normalizeStyleExpression`, `normalizeStyleBranch`, `normalizeMixedStyleTernaries`
- `buildUnknownSpreadFallback`
- All `asStyleArray` references

Keep/adapt:

- `rewriteExpressionSites()` main entry (simplified)
- `buildPropsCall()` → emits `trussProps({...})` spread
- `buildCssSpreadExpression()` → emits `mergeProps(className, style, {...})`
- `rewriteCssPropsCalls()` → rewrites `Css.props(expr)` to `trussProps(expr)`
- `rewriteCssAttributeExpressions()` second-pass traversal (simplified)
- Conditional ternary handling (object branches, not array branches)
- Debug info injection (`buildDebugElements`)

The key change: every `Css.*.$` site becomes an `ObjectExpression` with CSS-property keys and string/tuple values. No intermediate `css.xxx` references. No `stylex.create` entries.

### 4. `transform.ts`

Update orchestration:

- Remove: `import * as stylex`, `stylex.create(...)` declaration, StyleX helper name reservation
- Remove: `collectCreateData`, `buildCreateDeclaration`, `buildCreateProperties`
- Add: call `collectAtomicRules(sites)` to populate CSS registry
- Add: inject `import { trussProps, mergeProps, TrussDebugInfo } from "@homebound/truss/runtime"`
- Add: in test/dev mode, inject `import { __injectTrussCSS } from "@homebound/truss/runtime"` + `__injectTrussCSS(cssText)` call with the file's CSS text
- Add: return `{ code, map, css }` where `css` is the generated CSS text (for the Vite plugin to collect in Phase 2)
- Keep: `findCssImportBinding`, chain extraction, `resolveFullChain`, error reporting

### 5. `transform.test.ts`

Rewrite all expectations. Each test should assert:

- **JS output**: `trussProps({...})` calls, `mergeProps(...)` calls, plain object expressions
- **CSS output**: atomic rules generated by the transform

Key test categories:

- Single static abbreviation (`Css.df.$`)
- Multi-property abbreviation (`Css.ba.$`, `Css.p1.$`)
- Dynamic with literal folding (`Css.mt(2).$`)
- Dynamic with runtime variable (`Css.mt(x).$`)
- Pseudo-class (`Css.black.onHover.blue.$`)
- Media query (`Css.black.ifSm.blue.$`)
- Stacked pseudo+media (`Css.black.ifSm.onHover.blue.$`)
- Pseudo-element (`Css.element("::placeholder").blue.$`)
- Multi-pseudo on same property (`Css.black.onHover.blue.onFocus.red.$`)
- Conditional (`Css.df.if(x).blue.else.red.$`)
- Object spread composition (native, no rewrite needed)
- `Css.props(...)` lowering
- JSX `css=` prop
- `className` + `css=` merge
- Debug mode output
- `add()` calls
- Shorthand expansion

## Definition of Done

- `npm test` passes for all transform tests
- `runtime.test.ts` passes
- No references to `stylex.create`, `stylex.props`, `asStyleArray`, or style arrays in the transform output
- The `emit-stylex.ts` file can be deleted (replaced by `emit-truss.ts`)
- `transform.ts` no longer imports or references StyleX
- CSS output is deterministic and correctly ordered by specificity tiers
